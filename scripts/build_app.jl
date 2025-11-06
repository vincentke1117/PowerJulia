#!/usr/bin/env julia

using Pkg
using PackageCompiler
using Dates
using Printf
using Logging

const PROJECT_ROOT = normpath(joinpath(@__DIR__, ".."))
const DEFAULT_OUTPUT_DIR = joinpath(PROJECT_ROOT, "build", "JGDOApp")
const DEFAULT_APP_NAME = get(ENV, "JGDO_APP_NAME", "JGDOApp")
const PRECOMPILE_FILE = joinpath(@__DIR__, "precompile_app.jl")
const RESOURCES_SRC = joinpath(PROJECT_ROOT, "Resources", "web_ui")

struct BuildConfig
    project_root::String
    output_dir::String
    app_name::String
    force::Bool
    precompile_file::String
    resources_src::String
end

function parse_args(args)
    output_dir = DEFAULT_OUTPUT_DIR
    app_name = DEFAULT_APP_NAME
    force = true

    i = 1
    while i <= length(args)
        arg = args[i]
        if arg in ("-o", "--output")
            i += 1
            i > length(args) && error("missing value for $(arg)")
            output_dir = abspath(args[i])
        elseif arg in ("-n", "--name")
            i += 1
            i > length(args) && error("missing value for $(arg)")
            app_name = args[i]
        elseif arg == "--no-force"
            force = false
        elseif arg in ("-h", "--help")
            print_usage()
            exit(0)
        else
            error("unknown argument: $(arg)")
        end
        i += 1
    end

    return BuildConfig(PROJECT_ROOT, output_dir, app_name, force, PRECOMPILE_FILE, RESOURCES_SRC)
end

function print_usage()
    println("Usage: julia scripts/build_app.jl [options]\n")
    println("Options:")
    println("  -o, --output <path>   指定输出目录 (默认 build/JGDOApp)")
    println("  -n, --name <name>     指定生成的应用名称 (默认 JGDOApp)")
    println("      --no-force        在目标目录已存在时不覆盖")
    println("  -h, --help            显示此帮助信息")
end

function ensure_environment(project_root)
    @info "Activating project" project_root
    Pkg.activate(project_root)
    Pkg.instantiate()
end

function build_app(config::BuildConfig)
    ensure_environment(config.project_root)

    @info "Creating app bundle" output=config.output_dir app=config.app_name
    if isfile(config.precompile_file)
        PackageCompiler.create_app(
            config.project_root,
            config.output_dir;
            app_name=config.app_name,
            force=config.force,
            precompile_execution_file=config.precompile_file,
        )
    else
        @warn "precompile file missing, skipping warm-up" path=config.precompile_file
        PackageCompiler.create_app(
            config.project_root,
            config.output_dir;
            app_name=config.app_name,
            force=config.force,
        )
    end

    copy_resources(config)
    write_build_stamp(config)

    @info "App bundle generated" output=config.output_dir
end

function copy_resources(config::BuildConfig)
    if !isdir(config.resources_src)
        @warn "static resources missing" path=config.resources_src
        return
    end

    resources_dest = joinpath(config.output_dir, "Resources", "web_ui")
    if isdir(resources_dest)
        rm(resources_dest; recursive=true, force=true)
    end
    mkpath(dirname(resources_dest))
    cp(config.resources_src, resources_dest; force=true)
    @info "Copied static resources" source=config.resources_src dest=resources_dest
end

function write_build_stamp(config::BuildConfig)
    stamp_path = joinpath(config.output_dir, "BUILD_INFO.txt")
    open(stamp_path, "w") do io
        timestamp = Dates.format(Dates.now(), "yyyy-mm-dd HH:MM:SS")
        @printf(io, "JGDO build completed at %s\n", timestamp)
        @printf(io, "Source: %s\n", config.project_root)
        @printf(io, "App Name: %s\n", config.app_name)
    end
end

function main()
    config = parse_args(ARGS)
    build_app(config)
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
