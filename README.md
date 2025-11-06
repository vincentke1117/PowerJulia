# Julia-Grid Designer & Optimizer (JG-DO)

Julia-Grid Designer & Optimizer 是一个端到端的原型项目，结合 GoJS 前端画布、Blink/Electron 桌面封装与 Julia/PowerModels 计算内核，实现配电网拖拽建模、潮流计算以及“拓扑重构 + 分布式电源优化”流程。本仓库遵循提供的 PRD 规范，关键能力如下：

- **拖拽式建模画布**：`Resources/web_ui/` 中的前端代码提供元件库、吸附网格、参数编辑与 JSON 导入导出。
- **拓扑 JSON 解析**：`src/topology.jl` 将前端拓扑转换成 PowerModels 兼容的数据结构，并执行单位校验、连通性检查与开关状态处理。
- **潮流计算与优化**：`src/powerflow.jl` 基于 PowerModels/Ipopt 运行 AC 潮流；`src/optimization.jl` 通过 DistFlow 近似构建 Juniper + HiGHS 混合整数模型，内置径向性与流量守恒约束，给出开关重构与 DG 调度方案，并统一返回 JSON 结果。
- **Blink 桥接**：`src/bridge.jl` 注册前端可调用的 Julia 函数，并在 `runs/` 目录中保存每次求解快照。
- **示例与脚手架**：`examples/sample_topology.json` 展示前端导出的拓扑结构，`Project.toml` 记录 Julia 依赖。
- **前端参数校验**：GoJS Inspector 支持按元件类型生成表单、校验数值范围/必填项，并在运行潮流或优化前拦截无效输入。

## 开发环境

1. 安装 Julia 1.9 及以上版本，进入仓库执行 `] activate .`。
2. 使用 `instantiate` 安装依赖。
   > 重构优化依赖 Juniper（封装 Ipopt + HiGHS），请确保本地环境能够编译/安装对应求解器二进制。
3. 运行 `using Blink; include("src/JGDO.jl");`，随后可通过 `Blink.Window()` 加载 `Resources/web_ui/index.html` 并调用 `JGDO.register_callbacks(win)` 完成桥接。
4. 前端资源默认从 `Resources/web_ui/vendor/go.js` 读取 GoJS，请将离线脚本放入该目录。

## 关键 API

- `JGDO.run_pf(json_string)`：接收前端拓扑 JSON 字符串，返回统一结构的潮流计算结果。
- `JGDO.run_reconfiguration_dg(json_string; optimizer=JGDO.default_reconfiguration_optimizer())`：执行开关重构 + DG 调度搜索，默认使用 Juniper (Ipopt + HiGHS) 求解 DistFlow MINLP，并输出优化前后损耗对比与调度建议。
- `JGDO.topology_to_powermodels(dict)`：将解析后的 JSON 字典转为 PowerModels 数据。
- `JGDO.write_run_snapshot(dict)`：按照 `runs/YYYYMMDD-hhmmss.json` 规则保存求解结果。

## 目录结构

```
Project.toml
src/
  JGDO.jl            # 主模块
  topology.jl        # 拓扑解析
  powerflow.jl       # AC 潮流
  optimization.jl    # 拓扑重构 + DG 优化
  bridge.jl          # Blink 注册
Resources/
  web_ui/
    index.html
    app.js
    styles.css
    vendor/
      go.js (待补充)
examples/
  sample_topology.json
runs/
  .gitkeep
```

## 快照与调试

调用 `JGDO.run_pf`/`JGDO.run_reconfiguration_dg` 成功后，返回数据会自动写入 `runs/`。可以通过比较快照 JSON 进行教学或回归验证。
若快照写入失败，`JGDO.write_run_snapshot` 会抛出 `SnapshotError`，Blink 桥接层会记录告警日志并继续返回原始计算结果，确保前端交互不受影响。

## 打包与分发

项目提供 `scripts/build_app.jl` 作为打包脚本，基于 PackageCompiler `create_app` 生成可分发目录。典型流程如下：

1. 安装系统依赖（如 Ipopt 二进制库），确保 `Project.toml` 中的包均能成功编译。
2. 在仓库根目录执行 `julia scripts/build_app.jl`，默认生成 `build/JGDOApp/`。
   - 使用 `-o/--output` 可重定向输出目录，`-n/--name` 可修改应用名称。
   - 若希望保留既有输出，可添加 `--no-force` 以避免覆盖。
3. 打包脚本会自动复制 `Resources/` 静态资源，并写入 `BUILD_INFO.txt` 记录时间与源目录。
4. `scripts/precompile_app.jl` 会在打包时执行样例潮流与重构请求，加速首次启动并验证核心管线。

生成目录内的可执行文件可直接启动 Blink 窗口并加载 `Resources/web_ui/index.html`。如需进一步封装为安装程序，可在此目录基础上集成平台特定的打包工具。

## 后续工作建议

- 丰富优化模型：在当前径向约束基础上探索 N-1 场景、阶段化开关操作或不平衡三相模型，或直接接入 PowerModels/PowerModelsDistribution 现成的重构模型。
- 结果可视化：结合线路/节点高亮与提示框，呈现潮流与重构决策的空间分布。
