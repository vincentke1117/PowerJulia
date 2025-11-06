using Test
using JSON3

using JGDO
using JGDO: TopologyError, ValidationError, SnapshotError, topology_to_powermodels, build_pf_payload, write_run_snapshot
using JGDO.Optimization

function base_topology()
    return Dict(
        "meta" => Dict(
            "baseMVA" => 100.0,
            "feeder" => "F1",
        ),
        "nodes" => Any[
            Dict("id" => "bus-1", "type" => "Bus", "kv" => 12.66, "is_slack" => true, "vm_pu" => 1.0, "va_deg" => 0.0),
            Dict("id" => "bus-2", "type" => "Bus", "kv" => 12.66, "vm_pu" => 1.0, "va_deg" => -0.5),
            Dict("id" => "bus-3", "type" => "Bus", "kv" => 12.66, "vm_pu" => 0.99, "va_deg" => -1.0),
            Dict("id" => "load-1", "type" => "Load", "p_kw" => 800.0, "q_kvar" => 200.0, "bus" => "bus-2"),
            Dict("id" => "grid-1", "type" => "Gen", "p_kw" => 600.0, "p_max_kw" => 2000.0, "q_kvar" => 100.0, "q_max_kvar" => 500.0, "bus" => "bus-1"),
            Dict("id" => "dg-1", "type" => "DG", "p_kw" => 500.0, "p_max_kw" => 800.0, "q_kvar" => 50.0, "bus" => "bus-3"),
        ],
        "links" => Any[
            Dict("id" => "line-12", "type" => "Line", "from" => "bus-1", "to" => "bus-2", "r_ohm" => 0.2, "x_ohm" => 0.4, "rate_mva" => 5.0, "status" => "CLOSED"),
            Dict("id" => "line-23", "type" => "Line", "from" => "bus-2", "to" => "bus-3", "r_ohm" => 0.1, "x_ohm" => 0.3, "rate_mva" => 5.0, "status" => "CLOSED"),
            Dict("id" => "sw-13", "type" => "Switch", "from" => "bus-1", "to" => "bus-3", "r_ohm" => 0.001, "x_ohm" => 0.003, "rate_mva" => 5.0, "status" => "OPEN"),
        ],
    )
end

@testset "Topology conversion" begin
    topo = base_topology()
    pm = topology_to_powermodels(topo)

    @test pm["baseMVA"] == 100.0
    @test length(pm["bus"]) == 3

    @test pm["bus"]["1"]["name"] == "bus-1"
    @test pm["bus"]["1"]["type"] == 3
    @test pm["bus"]["2"]["name"] == "bus-2"

    load = only(values(pm["load"]))
    @test load["load_bus"] == 2
    @test isapprox(load["pd"], 0.8; atol=1e-6)
    @test isapprox(load["qd"], 0.2; atol=1e-6)

    @test length(pm["gen"]) == 2
    slack_gen = pm["gen"]["1"]
    dg = pm["gen"]["2"]
    @test slack_gen["gen_bus"] == 1
    @test dg["gen_bus"] == 3
    @test isapprox(dg["pg"], 0.5; atol=1e-6)
    @test dg["status"] == 1

    branches = collect(values(pm["branch"]))
    line12 = only(filter(b -> b["name"] == "line-12", branches))
    z_base = (pm["bus"]["1"]["base_kv"]^2) / pm["baseMVA"]
    @test isapprox(line12["br_r"], 0.2 / z_base; atol=1e-6)
    @test line12["status"] == 1

    switch13 = only(filter(b -> b["name"] == "sw-13", branches))
    @test switch13["status"] == 0
    @test switch13["device_type"] == "switch"
end

@testset "Topology validation" begin
    no_slack = base_topology()
    no_slack["nodes"][1]["is_slack"] = false
    @test_throws TopologyError topology_to_powermodels(no_slack)

    missing_base = base_topology()
    delete!(missing_base["meta"], "baseMVA")
    @test_throws ValidationError topology_to_powermodels(missing_base)

    islanded = base_topology()
    islanded["links"][1]["status"] = "OPEN"
    islanded["links"][2]["status"] = "OPEN"
    @test_throws TopologyError topology_to_powermodels(islanded)
end

@testset "Power flow payload" begin
    pm_data = Dict(
        "bus" => Dict(
            "1" => Dict("name" => "bus-1", "vm" => 1.0, "va" => 0.0),
            "2" => Dict("name" => "bus-2", "vm" => 0.99, "va" => -1.2),
        ),
        "branch" => Dict(
            "1" => Dict("name" => "line-12", "rate_a" => 5.0),
            "2" => Dict("name" => "sw-13", "rate_a" => 0.0),
        ),
    )

    result = Dict(
        "solution" => Dict(
            "bus" => Dict(
                "1" => Dict("vm" => 0.985, "va" => -0.4),
                "2" => Dict("vm" => 0.975, "va" => -1.1),
            ),
            "branch" => Dict(
                "1" => Dict("pf" => 0.6, "qf" => 0.2, "pl" => 0.05),
                "2" => Dict("pf" => 0.0, "qf" => 0.0),
            ),
        ),
        "iterations" => 7,
    )

    payload = build_pf_payload((pm_data=pm_data, result=result))
    @test payload["status"] == "ok"
    @test payload["type"] == "ac_pf"
    @test length(payload["buses"]) == 2
    @test payload["buses"][1]["id"] == "bus-1"
    @test isapprox(payload["branches"][1]["loading_pct"], sqrt(0.6^2 + 0.2^2) / 5.0 * 100; atol=1e-6)
    @test isapprox(payload["summary"]["loss_mw"], 0.05; atol=1e-6)
    @test payload["summary"]["iter"] == 7
end

@testset "Reconfiguration dataset" begin
    pm = topology_to_powermodels(base_topology())
    data = Optimization.build_dataset(pm)

    @test data.base_mva == 100.0
    @test length(data.branch_keys) == 3
    @test length(data.gen_keys) == 2
    @test data.branches[3].switchable
    @test data.gens["1"].bus == 1
    @test data.gens["2"].pmax > data.gens["2"].pmin
    @test data.required_closed == length(data.bus_keys) - 1
    @test data.root_bus in data.slack_buses

    switches = Optimization.collect_switch_status(pm)
    @test length(switches) == 1
    @test switches[1]["id"] == "sw-13"
    @test switches[1]["status"] == "OPEN"
end

@testset "Snapshot persistence" begin
    mktempdir() do dir
        data = Dict(
            "status" => "ok",
            "meta" => Dict("baseMVA" => 100.0),
            "buses" => [Dict("id" => "bus-1", "vm_pu" => 1.0)],
        )
        path = write_run_snapshot(data; runs_dir=dir)
        @test isfile(path)
        stored = JSON3.read(read(path, String))
        @test stored["status"] == "ok"
        @test haskey(stored, "buses")
    end
end

@testset "Snapshot error handling" begin
    mktempdir() do dir
        data = Dict("status" => "ok")
        Base.Filesystem.chmod(dir, 0o500)
        try
            @test_throws SnapshotError write_run_snapshot(data; runs_dir=dir)
        finally
            Base.Filesystem.chmod(dir, 0o700)
        end
    end
end
