using Pkg
Pkg.activate(joinpath(@__DIR__, ".."))
Pkg.instantiate()

using Logging
using JGDO
using JSON3

sample_path = joinpath(@__DIR__, "..", "examples", "sample_topology.json")
if isfile(sample_path)
    topo_json = read(sample_path, String)
    try
        JGDO.run_pf(topo_json)
    catch err
        @warn "power flow precompile invocation failed" err
    end

    try
        JGDO.run_reconfiguration_dg(topo_json)
    catch err
        @warn "reconfiguration precompile invocation failed" err
    end
end
