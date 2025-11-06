module Optimization

using JuMP
using Juniper
using HiGHS
using Ipopt
using Logging: @debug
import MathOptInterface as MOI

import ..Errors: TopologyError
import ..PowerFlow: execute_power_flow, build_pf_payload, default_optimizer

export execute_reconfiguration, default_reconfiguration_optimizer

const DEFAULT_BIGM_FLOW = 10.0

struct BranchData
    key::String
    name::String
    index::Int
    f_bus::Int
    t_bus::Int
    r::Float64
    x::Float64
    rate_pu::Float64
    rate_sq::Float64
    switchable::Bool
    status::Int
end

struct GenData
    key::String
    bus::Int
    name::String
    pmin::Float64
    pmax::Float64
    qmin::Float64
    qmax::Float64
    pg::Float64
    qg::Float64
    status::Int
end

function default_reconfiguration_optimizer()
    nl = optimizer_with_attributes(Ipopt.Optimizer, "print_level" => 0)
    mip = optimizer_with_attributes(HiGHS.Optimizer, "log_to_console" => false)
    return optimizer_with_attributes(
        Juniper.Optimizer,
        "nl_solver" => nl,
        "mip_solver" => mip,
        "log_levels" => Dict("juniper" => 0, "mip" => 0, "nlp" => 0),
    )
end

function execute_reconfiguration(pm_data::Dict; optimizer=default_reconfiguration_optimizer(), pf_optimizer=default_optimizer())
    baseline = execute_power_flow(pm_data; optimizer=pf_optimizer)
    baseline_payload = build_pf_payload(baseline)
    baseline_loss = baseline_payload["summary"]["loss_mw"]

    dataset = build_dataset(pm_data)
    model = build_model(dataset; optimizer)
    optimize!(model)

    termination = termination_status(model)
    if termination ∉ (MOI.OPTIMAL, MOI.LOCALLY_SOLVED)
        throw(TopologyError("reconfiguration optimizer failed: " * String(termination)))
    end

    if !has_values(model)
        throw(TopologyError("reconfiguration optimizer returned no solution"))
    end

    z_val = value.(dataset.z)
    pg_val = value.(dataset.pg)
    qg_val = value.(dataset.qg)

    updated_pm = apply_solution(pm_data, dataset, z_val, pg_val, qg_val)
    optimized_solution = execute_power_flow(updated_pm; optimizer=pf_optimizer)
    optimized_payload = build_pf_payload(optimized_solution)

    switch_schedule = collect_switch_status(updated_pm)
    dg_dispatch = collect_dg_dispatch(updated_pm, optimized_solution)

    summary = Dict(
        "loss_before_mw" => baseline_loss,
        "loss_after_mw" => optimized_payload["summary"]["loss_mw"],
        "improvement_pct" => baseline_loss > 0 ? (baseline_loss - optimized_payload["summary"]["loss_mw"]) / baseline_loss * 100 : 0.0,
        "solve_time_s" => objective_runtime(model),
    )

    return Dict(
        "status" => "ok",
        "type" => "reconfiguration_dg",
        "switch_schedule" => switch_schedule,
        "dg_dispatch" => dg_dispatch,
        "summary" => summary,
        "pf" => optimized_payload,
    )
end

function build_dataset(pm_data)
    base_mva = pm_data["baseMVA"]
    bus_keys = sort(parse.(Int, collect(keys(pm_data["bus"]))))
    branch_keys = sort(parse.(Int, collect(keys(pm_data["branch"]))))
    gen_keys = sort(collect(keys(pm_data["gen"])))

    buses = Dict(k => pm_data["bus"][string(k)] for k in bus_keys)

    vmin_sq = Dict(k => (buses[k]["vmin"])^2 for k in bus_keys)
    vmax_sq = Dict(k => (buses[k]["vmax"])^2 for k in bus_keys)
    vm_sq = Dict(k => (buses[k]["vm"])^2 for k in bus_keys)
    slack_buses = [k for k in bus_keys if buses[k]["type"] == 3]

    load_pd = Dict(k => 0.0 for k in bus_keys)
    load_qd = Dict(k => 0.0 for k in bus_keys)
    for load in values(pm_data["load"])
        bus = load["load_bus"]
        load_pd[bus] += load["pd"] / base_mva
        load_qd[bus] += load["qd"] / base_mva
    end

    gens = Dict{String,GenData}()
    bus_gens = Dict(k => String[] for k in bus_keys)
    for key in gen_keys
        gen = pm_data["gen"][key]
        bus = gen["gen_bus"]
        info = GenData(
            key,
            bus,
            gen["name"],
            gen["pmin"] / base_mva,
            gen["pmax"] / base_mva,
            gen["qmin"] / base_mva,
            gen["qmax"] / base_mva,
            gen["pg"] / base_mva,
            gen["qg"] / base_mva,
            gen["status"],
        )
        gens[key] = info
        push!(bus_gens[bus], key)
    end

    branches = Dict{Int,BranchData}()
    outgoing = Dict(k => Int[] for k in bus_keys)
    incoming = Dict(k => Int[] for k in bus_keys)

    for idx in branch_keys
        branch = pm_data["branch"][string(idx)]
        rate_mva = max(get(branch, "rate_a", base_mva), 0.0)
        rate_pu = rate_mva > 0 ? rate_mva / base_mva : DEFAULT_BIGM_FLOW
        rate_sq = rate_pu^2
        device = lowercase(String(get(branch, "device_type", branch["name"])))
        switchable = occursin("switch", device)
        status = branch["status"]
        data = BranchData(
            string(idx),
            branch["name"],
            idx,
            branch["f_bus"],
            branch["t_bus"],
            branch["br_r"],
            branch["br_x"],
            rate_pu,
            rate_sq,
            switchable,
            status,
        )
        branches[idx] = data
        push!(outgoing[data.f_bus], idx)
        push!(incoming[data.t_bus], idx)
    end

    big_v = maximum(values(vmax_sq)) - minimum(values(vmin_sq)) + 0.5

    model = Model()
    num_buses = length(bus_keys)
    root_bus = minimum(slack_buses)
    required_closed = max(num_buses - 1, 0)
    flow_limit = max(required_closed, 1)
    @variable(model, v[b in bus_keys], lower_bound=vmin_sq[b], upper_bound=vmax_sq[b])
    @variable(model, p[l in branch_keys])
    @variable(model, q[l in branch_keys])
    @variable(model, s[l in branch_keys] >= 0)
    @variable(model, z[l in branch_keys], Bin)
    @variable(model, flow[l in branch_keys])
    @variable(model, pg[key in gen_keys], lower_bound=gens[key].pmin, upper_bound=gens[key].pmax)
    @variable(model, qg[key in gen_keys], lower_bound=gens[key].qmin, upper_bound=gens[key].qmax)

    for b in bus_keys
        set_start_value(v[b], vm_sq[b])
    end

    for key in gen_keys
        set_start_value(pg[key], gens[key].pg)
        set_start_value(qg[key], gens[key].qg)
        if gens[key].status == 0
            fix(pg[key], 0.0; force=true)
            fix(qg[key], 0.0; force=true)
        end
    end

    for idx in branch_keys
        data = branches[idx]
        m = max(data.rate_pu, DEFAULT_BIGM_FLOW)
        @constraint(model, p[idx] <= m * z[idx])
        @constraint(model, p[idx] >= -m * z[idx])
        @constraint(model, q[idx] <= m * z[idx])
        @constraint(model, q[idx] >= -m * z[idx])
        @constraint(model, s[idx] <= (data.rate_sq + 1e-6) * z[idx])
        @NLconstraint(model, p[idx]^2 + q[idx]^2 <= s[idx] * v[data.f_bus])
        @NLconstraint(model, v[data.t_bus] - v[data.f_bus] + 2 * (data.r * p[idx] + data.x * q[idx]) - (data.r^2 + data.x^2) * s[idx] <= big_v * (1 - z[idx]))
        @NLconstraint(model, v[data.t_bus] - v[data.f_bus] + 2 * (data.r * p[idx] + data.x * q[idx]) - (data.r^2 + data.x^2) * s[idx] >= -big_v * (1 - z[idx]))
        @constraint(model, flow[idx] <= flow_limit * z[idx])
        @constraint(model, flow[idx] >= -flow_limit * z[idx])

        set_start_value(p[idx], 0.0)
        set_start_value(q[idx], 0.0)
        set_start_value(s[idx], 0.0)
        set_start_value(flow[idx], 0.0)

        if !data.switchable
            fix(z[idx], data.status; force=true)
        else
            set_start_value(z[idx], data.status)
        end
    end

    for b in bus_keys
        outgoing_indices = outgoing[b]
        incoming_indices = incoming[b]
        pg_terms = sum(pg[key] for key in bus_gens[b])
        qg_terms = sum(qg[key] for key in bus_gens[b])
        @constraint(model, sum(p[idx] for idx in outgoing_indices) - sum(p[idx] for idx in incoming_indices) + pg_terms - load_pd[b] == 0)
        @constraint(model, sum(q[idx] for idx in outgoing_indices) - sum(q[idx] for idx in incoming_indices) + qg_terms - load_qd[b] == 0)

        flow_balance = sum(flow[idx] for idx in outgoing_indices) - sum(flow[idx] for idx in incoming_indices)
        if b == root_bus
            @constraint(model, flow_balance == required_closed)
        else
            @constraint(model, flow_balance == -1)
        end
    end

    for b in slack_buses
        fix(v[b], vm_sq[b]; force=true)
    end

    if required_closed > 0
        @constraint(model, sum(z[idx] for idx in branch_keys) == required_closed)
    end

    @objective(model, Min, base_mva * sum(branches[idx].r * s[idx] for idx in branch_keys))

    return (
        ;
        model,
        base_mva,
        bus_keys,
        branch_keys,
        gen_keys,
        branches,
        gens,
        v,
        p,
        q,
        s,
        z,
        pg,
        qg,
        flow,
        slack_buses,
        root_bus,
        required_closed,
    )
end

function build_model(dataset; optimizer)
    set_optimizer(dataset.model, optimizer)
    return dataset.model
end

function apply_solution(pm_data, dataset, z_val, pg_val, qg_val)
    updated = deepcopy(pm_data)

    for idx in dataset.branch_keys
        data = dataset.branches[idx]
        status = data.switchable ? (z_val[idx] >= 0.5 ? 1 : 0) : data.status
        updated["branch"][data.key]["status"] = status
    end

    for key in dataset.gen_keys
        info = dataset.gens[key]
        updated["gen"][key]["pg"] = pg_val[key] * dataset.base_mva
        updated["gen"][key]["qg"] = qg_val[key] * dataset.base_mva
    end

    return updated
end

function collect_switch_status(pm_data)
    states = Vector{Dict{String,Any}}()
    for branch in values(pm_data["branch"])
        if occursin("switch", lowercase(String(get(branch, "device_type", branch["name"]))))
            status = branch["status"] == 1 ? "CLOSED" : "OPEN"
            push!(states, Dict("id" => branch["name"], "status" => status))
        end
    end
    return sort!(states, by = x -> x["id"])
end

function collect_dg_dispatch(pm_data, solution)
    result = solution.result
    solution_gen = get(get(result, "solution", Dict()), "gen", Dict())
    dispatch = Vector{Dict{String,Any}}()
    for (key, gen) in sort(collect(pm_data["gen"]))
        sol = get(solution_gen, key, Dict())
        push!(dispatch, Dict(
            "id" => gen["name"],
            "p_mw" => get(sol, "pg", gen["pg"]),
            "q_mvar" => get(sol, "qg", gen["qg"]),
        ))
    end
    return dispatch
end

function objective_runtime(model)
    try
        return MOI.get(model, MOI.SolveTime())
    catch
        return missing
    end
end

end

using .Optimization: execute_reconfiguration, default_reconfiguration_optimizer
