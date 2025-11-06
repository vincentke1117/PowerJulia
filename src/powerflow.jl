module PowerFlow

using JSON3
using PowerModels
using Ipopt
using JuMP: optimizer_with_attributes

import ..Errors: TopologyError, ValidationError

export execute_power_flow, build_pf_payload, default_optimizer

function default_optimizer()
    return optimizer_with_attributes(Ipopt.Optimizer, "print_level" => 0)
end

function execute_power_flow(pm_data::Dict; optimizer=default_optimizer())
    result = PowerModels.solve_ac_pf(pm_data, optimizer)
    status = Symbol(get(result, "status", :error))
    valid_statuses = Set([:local_optimum, :solved, :optimal, :feasible, :locally_optimal, :optimal_feasible])
    if status ∉ valid_statuses
        throw(TopologyError("power flow failed: " * String(status)))
    end
    return (pm_data=pm_data, result=result)
end

function build_pf_payload(data)
    pm_data = data.pm_data
    result = data.result
    solution = get(result, "solution", Dict())
    bus_solution = get(solution, "bus", Dict())
    branch_solution = get(solution, "branch", Dict())

    buses = Vector{Dict{String,Any}}()
    for (key, bus) in sort(collect(pm_data["bus"]))
        sol = get(bus_solution, key, Dict())
        push!(buses, Dict(
            "id" => bus["name"],
            "vm_pu" => get(sol, "vm", bus["vm"]),
            "va_deg" => get(sol, "va", bus["va"]),
        ))
    end

    branches = Vector{Dict{String,Any}}()
    for (key, branch) in sort(collect(pm_data["branch"]))
        sol = get(branch_solution, key, Dict())
        push!(branches, Dict(
            "id" => branch["name"],
            "p_mw" => get(sol, "pf", 0.0),
            "q_mvar" => get(sol, "qf", 0.0),
            "loading_pct" => compute_loading(branch, sol),
        ))
    end

    loss_mw = compute_losses(branch_solution)
    iter = get(result, "iterations", get(result, "iter", missing))
    return Dict(
        "status" => "ok",
        "type" => "ac_pf",
        "buses" => buses,
        "branches" => branches,
        "summary" => Dict(
            "loss_mw" => loss_mw,
            "iter" => iter,
        ),
    )
end

function compute_losses(branch_solution)
    total = 0.0
    for branch in values(branch_solution)
        if haskey(branch, "pl")
            total += branch["pl"]
        elseif haskey(branch, "pf") && haskey(branch, "pt")
            total += max(branch["pf"] + branch["pt"], 0.0)
        end
    end
    return total
end

function compute_loading(branch, sol)
    rate = get(branch, "rate_a", 0.0)
    if rate <= 0
        return 0.0
    end
    p = get(sol, "pf", 0.0)
    q = get(sol, "qf", 0.0)
    loading = sqrt(p^2 + q^2) / rate * 100
    return loading
end

end

using .PowerFlow: execute_power_flow, build_pf_payload, default_optimizer
