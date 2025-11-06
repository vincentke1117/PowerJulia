(function () {
  const $ = go.GraphObject.make;

  const SWITCH_STATUS_OPTIONS = [
    { value: 'CLOSED', label: '合闸 (CLOSED)' },
    { value: 'OPEN', label: '分闸 (OPEN)' }
  ];
  const GENERATOR_STATUS_OPTIONS = [
    { value: 1, label: '投入 (1)' },
    { value: 0, label: '停运 (0)' }
  ];

  const NODE_SCHEMA_BUILDERS = {
    base: [
      { name: 'name', label: '名称', type: 'text', required: true, placeholder: 'bus-1', source: 'top' }
    ],
    Bus: [
      { name: 'kv', label: '额定电压 (kV)', type: 'number', required: true, min: 0.001, step: 0.01 },
      { name: 'vm_pu', label: '电压幅值 (p.u.)', type: 'number', required: true, min: 0.5, max: 1.5, step: 0.001 },
      { name: 'va_deg', label: '相角 (°)', type: 'number', required: true, step: 0.1 },
      { name: 'vmax_pu', label: '电压上限 (p.u.)', type: 'number', min: 0.8, max: 1.2, step: 0.001 },
      { name: 'vmin_pu', label: '电压下限 (p.u.)', type: 'number', min: 0.8, max: 1.2, step: 0.001 },
      { name: 'is_slack', label: '是否平衡节点', type: 'checkbox' },
      { name: 'is_pv', label: '是否 PV 节点', type: 'checkbox' }
    ],
    Load: (context) => [
      { name: 'p_kw', label: '有功负荷 (kW)', type: 'number', required: true, min: 0 },
      { name: 'q_kvar', label: '无功负荷 (kVar)', type: 'number', required: true },
      busField(context)
    ],
    Gen: (context) => generatorFields(context, '发电机'),
    DG: (context) => generatorFields(context, '分布式电源'),
    Transformer: [
      { name: 'tap', label: '分接比', type: 'number', required: true, min: 0.01, step: 0.001 },
      { name: 'shift_deg', label: '相移 (°)', type: 'number', step: 0.1 }
    ],
    Switch: [
      { name: 'status', label: '开关状态', type: 'select', required: true, options: () => SWITCH_STATUS_OPTIONS },
      { name: 'r_ohm', label: '电阻 (Ω)', type: 'number', min: 0, step: 0.0001 },
      { name: 'x_ohm', label: '电抗 (Ω)', type: 'number', min: 0, step: 0.0001 }
    ]
  };

  const LINK_SCHEMA_BUILDERS = {
    base: [
      { name: 'status', label: '状态', type: 'select', required: true, options: () => SWITCH_STATUS_OPTIONS }
    ],
    Line: [
      { name: 'r_ohm', label: '电阻 (Ω)', type: 'number', required: true, min: 0, step: 0.0001 },
      { name: 'x_ohm', label: '电抗 (Ω)', type: 'number', required: true, min: 0, step: 0.0001 },
      { name: 'rate_mva', label: '容量 (MVA)', type: 'number', min: 0, step: 0.1 }
    ],
    Switch: [
      { name: 'r_ohm', label: '电阻 (Ω)', type: 'number', min: 0, step: 0.0001 },
      { name: 'x_ohm', label: '电抗 (Ω)', type: 'number', min: 0, step: 0.0001 }
    ],
    Transformer: [
      { name: 'r_ohm', label: '电阻 (Ω)', type: 'number', min: 0, step: 0.0001 },
      { name: 'x_ohm', label: '电抗 (Ω)', type: 'number', min: 0, step: 0.0001 },
      { name: 'tap', label: '分接比', type: 'number', min: 0.01, step: 0.001 },
      { name: 'shift_deg', label: '相移 (°)', type: 'number', step: 0.1 }
    ]
  };

  const palette = $(go.Palette, 'palette', {
    nodeTemplateMap: buildNodeTemplates(),
    model: new go.GraphLinksModel(getPaletteData(), [])
  });

  const diagram = $(go.Diagram, 'diagram', {
    grid: $(go.Panel, 'Grid',
      $(go.Shape, 'LineH', { stroke: '#e0e0e0', strokeWidth: 0.5 }),
      $(go.Shape, 'LineV', { stroke: '#e0e0e0', strokeWidth: 0.5 })
    ),
    'grid.visible': true,
    'draggingTool.isGridSnapEnabled': true,
    'resizingTool.isGridSnapEnabled': true,
    'undoManager.isEnabled': true,
    allowCopy: true,
    linkTemplate: buildLinkTemplate(),
    nodeTemplateMap: buildNodeTemplates()
  });

  setupDiagram(diagram);
  bindUiEvents(diagram);
  restoreFromLocalStorage(diagram);

  diagram.addDiagramListener('ObjectDoubleClicked', (e) => {
    const part = e.subject.part;
    if (part instanceof go.Node || part instanceof go.Link) {
      openInspector(part, diagram);
    }
  });

  function buildNodeTemplates() {
    const templateMap = new go.Map('string', go.Node);
    templateMap.add('Bus',
      $(go.Node, 'Auto',
        nodeStyle(),
        $(go.Shape, 'Rectangle', { fill: '#fff', stroke: '#1976d2', strokeWidth: 2, width: 80, height: 40 }),
        $(go.TextBlock, textStyle(), new go.Binding('text', 'name'))
      )
    );
    templateMap.add('Load',
      $(go.Node, 'Auto',
        nodeStyle(),
        $(go.Shape, 'Circle', { fill: '#fffde7', stroke: '#f57f17', strokeWidth: 2, width: 50, height: 50 }),
        $(go.TextBlock, textStyle(), new go.Binding('text', 'name'))
      )
    );
    templateMap.add('Gen',
      $(go.Node, 'Auto',
        nodeStyle(),
        $(go.Shape, 'Diamond', { fill: '#e3f2fd', stroke: '#0d47a1', strokeWidth: 2, width: 60, height: 60 }),
        $(go.TextBlock, textStyle(), new go.Binding('text', 'name'))
      )
    );
    templateMap.add('DG', templateMap.getValue('Gen'));
    templateMap.add('Transformer',
      $(go.Node, 'Auto',
        nodeStyle(),
        $(go.Shape, 'RoundedRectangle', { fill: '#ede7f6', stroke: '#5e35b1', strokeWidth: 2, width: 80, height: 60 }),
        $(go.TextBlock, textStyle(), new go.Binding('text', 'name'))
      )
    );
    templateMap.add('Switch',
      $(go.Node, 'Auto',
        nodeStyle(),
        $(go.Shape, 'Circle', { fill: '#fff', stroke: '#009688', strokeWidth: 2, width: 40, height: 40 }),
        $(go.TextBlock, textStyle(), new go.Binding('text', 'name'))
      )
    );
    return templateMap;
  }

  function nodeStyle() {
    return [
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      {
        locationSpot: go.Spot.Center,
        toolTip: $(go.Adornment, 'Auto',
          $(go.Shape, { fill: '#333', stroke: null }),
          $(go.TextBlock, { margin: 4, stroke: '#fff' }, new go.Binding('text', '', data => JSON.stringify(data.data || {}, null, 2)))
        )
      }
    ];
  }

  function textStyle() {
    return {
      font: '12px "Noto Sans SC", sans-serif',
      stroke: '#212121'
    };
  }

  function buildLinkTemplate() {
    return $(go.Link,
      {
        routing: go.Link.AvoidsNodes,
        curve: go.Link.JumpGap,
        corner: 6,
        relinkableFrom: true,
        relinkableTo: true,
        selectionAdornmentTemplate: $(go.Adornment, 'Link', $(go.Shape, { isPanelMain: true, stroke: '#ff7043', strokeWidth: 4 }))
      },
      new go.Binding('points').makeTwoWay(),
      $(go.Shape, { stroke: '#546e7a', strokeWidth: 2 }),
      $(go.Shape, { toArrow: 'Triangle', fill: '#546e7a', stroke: null })
    );
  }

  function getPaletteData() {
    return [
      { category: 'Bus', name: 'Bus', type: 'Bus', data: { kv: 10.5, is_slack: false, vm_pu: 1.0, va_deg: 0.0 } },
      { category: 'Load', name: 'Load', type: 'Load', data: { p_kw: 500, q_kvar: 200, bus: '' } },
      { category: 'Gen', name: 'Gen', type: 'Gen', data: { p_kw: 500, p_max_kw: 800, p_min_kw: 0, status: 1, bus: '' } },
      { category: 'DG', name: 'DG', type: 'DG', data: { p_kw: 200, p_max_kw: 400, p_min_kw: 0, status: 1, bus: '' } },
      { category: 'Transformer', name: 'XFMR', type: 'Transformer', data: { tap: 1.0, shift_deg: 0.0 } },
      { category: 'Switch', name: 'Switch', type: 'Switch', data: { status: 'CLOSED', r_ohm: 0.0, x_ohm: 0.0 } }
    ];
  }

  function setupDiagram(diagram) {
    diagram.model = new go.GraphLinksModel([], []);
    diagram.model.linkFromPortIdProperty = 'fromPort';
    diagram.model.linkToPortIdProperty = 'toPort';
    diagram.model.makeUniqueKeyFunction = (model, data) => data.id || go.Model.generateKey();
    diagram.model.makeUniqueLinkKeyFunction = (model, data) => data.id || go.Model.generateKey();
    diagram.model.copiesArrays = true;
    diagram.model.copiesArrayObjects = true;
    diagram.addDiagramListener('Modified', () => {
      if (!diagram.isModified) return;
      persistToLocalStorage(diagram);
      diagram.isModified = false;
    });
  }

  function bindUiEvents(diagram) {
    document.getElementById('btn-load-topology').addEventListener('click', () => openFilePicker(diagram));
    document.getElementById('btn-save-topology').addEventListener('click', () => saveTopology(diagram));
    document.getElementById('btn-run-pf').addEventListener('click', () => runPf(diagram));
    document.getElementById('btn-run-optimization').addEventListener('click', () => runOptimization(diagram));
  }

  function openInspector(part, diagram) {
    const isLink = part instanceof go.Link;
    const context = {
      diagram,
      part,
      busIds: new Set(diagram.model.nodeDataArray.filter((node) => (node.type || node.category) === 'Bus').map((node) => node.key))
    };
    const type = part.data.type || part.data.category || (isLink ? 'Line' : 'Bus');
    const schema = isLink ? buildLinkSchema(type, context) : buildNodeSchema(type, context);
    if (!schema.length) {
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'inspector';
    const form = document.createElement('form');
    form.id = 'inspector-form';
    form.autocomplete = 'off';

    const errorBox = document.createElement('div');
    errorBox.id = 'inspector-errors';
    errorBox.className = 'inspector-errors';
    form.appendChild(errorBox);

    schema.forEach((field) => {
      form.appendChild(renderField(field, getCurrentValue(part, field), context));
    });

    const menu = document.createElement('menu');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.dataset.action = 'cancel';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'primary-action';
    saveBtn.textContent = '保存';
    menu.append(cancelBtn, saveBtn);

    dialog.append(form, menu);
    document.body.appendChild(dialog);
    dialog.showModal();

    cancelBtn.addEventListener('click', () => dialog.close('cancel'));
    form.addEventListener('submit', (evt) => {
      evt.preventDefault();
      const rawValues = collectRawValues(form, schema);
      const { values, errors } = coerceAndValidate(rawValues, schema, context);
      displayErrors(form, schema, errors);
      if (Object.keys(errors).length) {
        return;
      }
      diagram.startTransaction('update element');
      if (isLink) {
        applyLinkUpdates(part, values, schema);
      } else {
        applyNodeUpdates(part, values, schema);
      }
      diagram.commitTransaction('update element');
      persistToLocalStorage(diagram);
      dialog.close('confirm');
    });

    dialog.addEventListener('close', () => {
      dialog.remove();
    });
  }

  function renderField(field, value) {
    const wrapper = document.createElement('label');
    wrapper.dataset.field = field.name;
    wrapper.className = 'field-group';
    const title = document.createElement('span');
    title.textContent = field.label + (field.required ? ' *' : '');
    wrapper.appendChild(title);

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.name = field.name;
      input.required = Boolean(field.required);
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = field.required ? '请选择...' : '无';
      input.appendChild(placeholder);
      const options = [...(field.options || [])];
      const knownValues = new Set(options.map((opt) => String(opt.value)));
      if (value !== undefined && value !== null && value !== '' && !knownValues.has(String(value))) {
        options.unshift({ value, label: String(value) });
      }
      options.forEach((opt) => {
        const option = document.createElement('option');
        option.value = String(opt.value);
        option.textContent = opt.label;
        input.appendChild(option);
      });
      if (value !== undefined && value !== null) {
        input.value = String(value);
      }
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.name = field.name;
      input.checked = Boolean(value);
      wrapper.classList.add('checkbox');
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : 'text';
      input.name = field.name;
      if (field.step !== undefined) {
        input.step = String(field.step);
      }
      if (field.min !== undefined) {
        input.min = String(field.min);
      }
      if (field.max !== undefined) {
        input.max = String(field.max);
      }
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
      if (value !== undefined && value !== null) {
        input.value = String(value);
      }
    }
    input.dataset.type = field.type;
    wrapper.appendChild(input);
    return wrapper;
  }

  function collectRawValues(form, schema) {
    const raw = {};
    schema.forEach((field) => {
      const element = form.elements[field.name];
      if (!element) return;
      if (field.type === 'checkbox') {
        raw[field.name] = element.checked;
      } else {
        raw[field.name] = element.value;
      }
    });
    return raw;
  }

  function displayErrors(form, schema, errors) {
    const errorBox = form.querySelector('#inspector-errors');
    if (errorBox) {
      const messages = Object.values(errors);
      errorBox.innerHTML = messages.map((msg) => `<div>${msg}</div>`).join('');
    }
    schema.forEach((field) => {
      const group = form.querySelector(`[data-field="${field.name}"]`);
      if (!group) return;
      if (errors[field.name]) {
        group.classList.add('has-error');
      } else {
        group.classList.remove('has-error');
      }
    });
  }

  function getCurrentValue(part, field) {
    const data = part.data || {};
    if (field.source === 'top') {
      return data[field.name];
    }
    const bucket = data.data || {};
    return bucket[field.name];
  }

  function applyNodeUpdates(part, values, schema) {
    const model = part.diagram.model;
    const data = part.data;
    const next = { ...(data.data || {}) };
    schema.forEach((field) => {
      const value = values[field.name];
      if (field.source === 'top') {
        if (value === undefined || value === '') {
          if (field.name in data) {
            model.setDataProperty(data, field.name, undefined);
            delete data[field.name];
          }
        } else {
          model.setDataProperty(data, field.name, value);
        }
        if (field.name === 'name') {
          if (value === undefined || value === '') {
            delete next.name;
          } else {
            next.name = value;
          }
        }
      } else if (field.type === 'checkbox') {
        next[field.name] = Boolean(value);
      } else if (value === undefined || value === '') {
        delete next[field.name];
      } else {
        next[field.name] = value;
      }
    });
    model.setDataProperty(data, 'data', next);
    model.updateTargetBindings(data);
  }

  function applyLinkUpdates(part, values, schema) {
    const model = part.diagram.model;
    const data = part.data;
    const next = { ...(data.data || {}) };
    schema.forEach((field) => {
      const value = values[field.name];
      if (field.type === 'checkbox') {
        next[field.name] = Boolean(value);
        return;
      }
      if (value === undefined || value === '') {
        delete next[field.name];
      } else {
        next[field.name] = value;
      }
    });
    model.setDataProperty(data, 'data', next);
    model.updateTargetBindings(data);
  }

  function openFilePicker(diagram) {
    const input = document.getElementById('file-input');
    input.value = '';
    input.onchange = async (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        importTopology(diagram, json);
        persistToLocalStorage(diagram);
      } catch (err) {
        alert(`无法解析文件: ${err.message}`);
      }
    };
    input.click();
  }

  function saveTopology(diagram) {
    const json = exportTopology(diagram);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${json.meta.feeder || 'topology'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportTopology(diagram) {
    const model = diagram.model.toJson();
    const data = JSON.parse(model);
    const nodes = data.nodeDataArray.map((node) => ({
      id: node.key,
      type: node.type || node.category,
      name: node.name,
      loc: node.loc,
      kv: node.data?.kv,
      p_kw: node.data?.p_kw,
      q_kvar: node.data?.q_kvar,
      p_max_kw: node.data?.p_max_kw,
      p_min_kw: node.data?.p_min_kw,
      q_max_kvar: node.data?.q_max_kvar,
      q_min_kvar: node.data?.q_min_kvar,
      status: node.data?.status,
      is_slack: node.data?.is_slack || false,
      is_pv: node.data?.is_pv || false,
      vm_pu: node.data?.vm_pu,
      va_deg: node.data?.va_deg,
      vmax_pu: node.data?.vmax_pu,
      vmin_pu: node.data?.vmin_pu,
      bus: node.data?.bus,
      tap: node.data?.tap,
      shift_deg: node.data?.shift_deg
    }));
    const links = data.linkDataArray.map((link) => ({
      id: link.key,
      from: link.from,
      to: link.to,
      type: link.type || link.category || 'Line',
      name: link.name || link.key,
      r_ohm: link.data?.r_ohm,
      x_ohm: link.data?.x_ohm,
      b_siemens: link.data?.b_siemens,
      rate_mva: link.data?.rate_mva,
      tap: link.data?.tap,
      shift_deg: link.data?.shift_deg,
      status: link.data?.status || 'CLOSED'
    }));
    return {
      meta: {
        baseMVA: 100,
        feeder: 'F1'
      },
      nodes,
      links
    };
  }

  function importTopology(diagram, topo) {
    const nodeDataArray = (topo.nodes || []).map((node) => ({
      key: node.id,
      category: node.type,
      type: node.type,
      name: node.name || node.id,
      loc: node.loc || go.Point.stringify(new go.Point(Math.random() * 400, Math.random() * 300)),
      data: { ...node }
    }));
    const linkDataArray = (topo.links || []).map((link) => ({
      key: link.id,
      from: link.from,
      to: link.to,
      category: link.type,
      type: link.type,
      name: link.name || link.id,
      data: { ...link }
    }));
    diagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
  }

  async function runPf(diagram) {
    const topo = exportTopology(diagram);
    const issues = validateTopology(topo);
    if (issues.length) {
      alert(`参数校验失败:\n${formatValidationErrors(issues)}`);
      return;
    }
    const payload = JSON.stringify(topo);
    try {
      const resp = await callJulia('run_pf', payload);
      updateResults(resp.data);
      appendHistory('AC 潮流', resp);
    } catch (err) {
      alert(err.message);
    }
  }

  async function runOptimization(diagram) {
    const topo = exportTopology(diagram);
    const issues = validateTopology(topo);
    if (issues.length) {
      alert(`参数校验失败:\n${formatValidationErrors(issues)}`);
      return;
    }
    const payload = JSON.stringify(topo);
    try {
      const resp = await callJulia('run_reconfiguration', payload);
      updateResults(resp.data?.pf || resp.data);
      appendHistory('拓扑重构 + DG', resp);
    } catch (err) {
      alert(err.message);
    }
  }

  async function callJulia(fnName, jsonString) {
    if (!window.Julia || typeof window.Julia.call !== 'function') {
      throw new Error('Julia 桥接尚未就绪');
    }
    const raw = await window.Julia.call(fnName, jsonString);
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (obj.status !== 'ok') {
      throw new Error(obj.message || 'Julia 返回错误');
    }
    return obj;
  }

  function updateResults(data) {
    if (!data) return;
    const results = document.getElementById('results');
    const buses = data.buses?.map((bus) => `<tr><td>${bus.id}</td><td>${bus.vm_pu?.toFixed(4)}</td><td>${bus.va_deg?.toFixed(2)}</td></tr>`).join('') || '';
    const branches = data.branches?.map((branch) => `<tr><td>${branch.id}</td><td>${branch.p_mw?.toFixed(4)}</td><td>${branch.loading_pct?.toFixed(2)}%</td></tr>`).join('') || '';
    results.innerHTML = `
      <section>
        <h3>节点电压</h3>
        <table><thead><tr><th>ID</th><th>Vm (p.u.)</th><th>Va (°)</th></tr></thead><tbody>${buses}</tbody></table>
      </section>
      <section>
        <h3>支路潮流</h3>
        <table><thead><tr><th>ID</th><th>P (MW)</th><th>载荷 (%)</th></tr></thead><tbody>${branches}</tbody></table>
      </section>
      <section>
        <h3>汇总</h3>
        <pre>${JSON.stringify(data.summary || {}, null, 2)}</pre>
      </section>
    `;
  }

  function appendHistory(label, response) {
    const list = document.getElementById('run-history');
    const item = document.createElement('li');
    const stamp = new Date().toLocaleString();
    item.innerHTML = `<strong>${label}</strong><br /><small>${stamp}</small><pre>${JSON.stringify(response.data.summary || {}, null, 2)}</pre>`;
    list.prepend(item);
  }

  function persistToLocalStorage(diagram) {
    const json = exportTopology(diagram);
    localStorage.setItem('jgdo-topology', JSON.stringify(json));
  }

  function restoreFromLocalStorage(diagram) {
    const stored = localStorage.getItem('jgdo-topology');
    if (stored) {
      try {
        importTopology(diagram, JSON.parse(stored));
      } catch (err) {
        console.warn('failed to restore diagram', err);
      }
    }
  }

  function validateTopology(topo) {
    const errors = [];
    const baseMVA = Number(topo.meta?.baseMVA);
    if (!Number.isFinite(baseMVA) || baseMVA <= 0) {
      errors.push('meta.baseMVA 需设置为正数');
    }
    const busIds = new Set(
      (topo.nodes || [])
        .filter((node) => String(node.type || node.category).toLowerCase() === 'bus')
        .map((node) => node.id)
    );
    if (!busIds.size) {
      errors.push('至少需要一个母线节点');
    }
    const context = { busIds };

    (topo.nodes || []).forEach((node) => {
      const schema = buildNodeSchema(node.type || node.category || 'Bus', context);
      if (!schema.length) return;
      const { errors: fieldErrors } = coerceAndValidate(pickValues(node, schema), schema, context);
      Object.entries(fieldErrors).forEach(([, msg]) => {
        errors.push(`节点 ${node.name || node.id}: ${msg}`);
      });
    });

    (topo.links || []).forEach((link) => {
      const schema = buildLinkSchema(link.type || link.category || 'Line', context);
      if (!schema.length) return;
      const { errors: fieldErrors } = coerceAndValidate(pickValues(link, schema), schema, context);
      Object.entries(fieldErrors).forEach(([, msg]) => {
        errors.push(`连线 ${link.name || link.id}: ${msg}`);
      });
      if (!busIds.has(link.from) || !busIds.has(link.to)) {
        errors.push(`连线 ${link.name || link.id} 需要连接到有效的母线节点`);
      }
    });

    return errors;
  }

  function formatValidationErrors(errors) {
    return errors.map((err, idx) => `${idx + 1}. ${err}`).join('\n');
  }

  function pickValues(obj, schema) {
    const values = {};
    schema.forEach((field) => {
      values[field.name] = obj[field.name];
    });
    return values;
  }

  function buildNodeSchema(type, context) {
    const base = NODE_SCHEMA_BUILDERS.base;
    const specificBuilder = lookupBuilder(type, NODE_SCHEMA_BUILDERS) || [];
    return resolveSchema(base, specificBuilder, context);
  }

  function buildLinkSchema(type, context) {
    const base = LINK_SCHEMA_BUILDERS.base;
    const specificBuilder = lookupBuilder(type, LINK_SCHEMA_BUILDERS) || [];
    return resolveSchema(base, specificBuilder, context);
  }

  function lookupBuilder(type, builders) {
    if (!type) return null;
    if (builders[type]) return builders[type];
    const lower = String(type).toLowerCase();
    const matchKey = Object.keys(builders).find((key) => key.toLowerCase() === lower);
    return matchKey ? builders[matchKey] : null;
  }

  function resolveSchema(base, specific, context) {
    const fields = [];
    [base, specific].forEach((section) => {
      if (!section) return;
      const arr = typeof section === 'function' ? section(context) : section;
      arr.forEach((field) => {
        const resolved = { source: 'data', ...field };
        if (typeof resolved.options === 'function') {
          resolved.options = resolved.options(context);
        }
        if (resolved.name === 'bus') {
          resolved.validate = resolved.validate || (({ value, context: ctx }) => {
            if (!value) return '请选择所属母线';
            if (ctx.busIds && ctx.busIds.size && !ctx.busIds.has(value)) {
              return '所属母线需存在于图中';
            }
            return null;
          });
        }
        fields.push(resolved);
      });
    });
    return fields;
  }

  function generatorFields(context, labelPrefix) {
    return [
      { name: 'p_kw', label: `${labelPrefix}额定有功 (kW)`, type: 'number', required: true, min: 0 },
      { name: 'p_max_kw', label: '最大有功 (kW)', type: 'number', required: true, min: 0,
        validate: ({ values }) => (values.p_max_kw ?? 0) < (values.p_kw ?? 0) ? '最大有功需大于等于额定有功' : null },
      { name: 'p_min_kw', label: '最小有功 (kW)', type: 'number', required: true, min: 0,
        validate: ({ values }) => {
          if (values.p_min_kw === undefined || values.p_max_kw === undefined) return null;
          return values.p_min_kw > values.p_max_kw ? '最小有功不能大于最大有功' : null;
        } },
      { name: 'q_kvar', label: '无功 (kVar)', type: 'number' },
      { name: 'q_max_kvar', label: '无功上限 (kVar)', type: 'number',
        validate: ({ values }) => {
          if (values.q_max_kvar === undefined || values.q_min_kvar === undefined) return null;
          return values.q_max_kvar < values.q_min_kvar ? '无功上限需大于等于无功下限' : null;
        } },
      { name: 'q_min_kvar', label: '无功下限 (kVar)', type: 'number' },
      busField(context),
      { name: 'status', label: '状态', type: 'select', required: true, options: () => GENERATOR_STATUS_OPTIONS, coerce: (value) => Number(value) }
    ];
  }

  function busField(context) {
    return {
      name: 'bus',
      label: '所属母线',
      type: 'select',
      required: true,
      options: () => {
        const buses = getBusOptions(context);
        return buses.length ? buses : [{ value: '', label: '请先创建母线' }];
      }
    };
  }

  function getBusOptions(context = {}) {
    if (context.diagram) {
      return context.diagram.model.nodeDataArray
        .filter((node) => (node.type || node.category) === 'Bus')
        .map((node) => ({ value: node.key, label: `${node.name || node.key}` }));
    }
    if (context.busIds) {
      return Array.from(context.busIds).map((id) => ({ value: id, label: id }));
    }
    return [];
  }

  function coerceAndValidate(rawValues, schema, context) {
    const values = {};
    const errors = {};
    schema.forEach((field) => {
      const raw = rawValues[field.name];
      const { value, error } = coerceField(field, raw);
      if (error) {
        errors[field.name] = error;
      }
      values[field.name] = value;
    });
    schema.forEach((field) => {
      if (errors[field.name]) return;
      if (typeof field.coerce === 'function' && values[field.name] !== undefined && values[field.name] !== '') {
        try {
          values[field.name] = field.coerce(values[field.name]);
        } catch (err) {
          errors[field.name] = '值无效';
        }
      }
      if (errors[field.name]) return;
      if (typeof field.validate === 'function') {
        const message = field.validate({ value: values[field.name], values, context });
        if (typeof message === 'string' && message.length) {
          errors[field.name] = message;
        }
      }
      if (field.type === 'select' && field.options && field.options.length && field.required) {
        const allowed = field.options.map((opt) => String(opt.value));
        const current = values[field.name];
        if (current === undefined || current === '') {
          errors[field.name] = '请选择有效的选项';
        } else if (!allowed.includes(String(current))) {
          errors[field.name] = '当前值不在可选项内';
        }
      }
    });
    return { values, errors };
  }

  function coerceField(field, raw) {
    if (field.type === 'checkbox') {
      return { value: Boolean(raw), error: null };
    }
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) {
        return { value: undefined, error: '该字段为必填项' };
      }
      return { value: undefined, error: null };
    }
    if (field.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        return { value: undefined, error: '请输入数值' };
      }
      if (field.min !== undefined && num < field.min) {
        return { value: undefined, error: `需不小于 ${field.min}` };
      }
      if (field.max !== undefined && num > field.max) {
        return { value: undefined, error: `需不大于 ${field.max}` };
      }
      return { value: num, error: null };
    }
    if (field.type === 'select') {
      return { value: raw, error: null };
    }
    const text = String(raw).trim();
    if (field.required && !text) {
      return { value: undefined, error: '该字段为必填项' };
    }
    return { value: text, error: null };
  }
})();
