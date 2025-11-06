module Bridge

using Blink
using JSON3
using Logging: @warn

import ..JGDO: run_pf, run_reconfiguration_dg, write_run_snapshot, DEFAULT_RUNS_DIR
import ..Errors: SnapshotError

export register_callbacks

function register_callbacks(window::Blink.Window; runs_dir=DEFAULT_RUNS_DIR)
    Blink.handle(window, "run_pf") do payload
        response = run_pf(String(payload))
        maybe_snapshot(response; runs_dir)
        return response
    end
    Blink.handle(window, "run_reconfiguration") do payload
        response = run_reconfiguration_dg(String(payload))
        maybe_snapshot(response; runs_dir)
        return response
    end
    return window
end

function maybe_snapshot(response::AbstractString; runs_dir=DEFAULT_RUNS_DIR)
    obj = JSON3.read(response)
    if get(obj, "status", "error") == "ok"
        data = get(obj, "data", nothing)
        if data !== nothing
            data_dict = JSON3.read(JSON3.write(data), Dict{String,Any})
            try
                write_run_snapshot(data_dict; runs_dir)
            catch err
                if err isa SnapshotError
                    @warn "snapshot persistence failed" error=err path=err.path
                else
                    rethrow()
                end
            end
        end
    end
end

end

using .Bridge: register_callbacks
