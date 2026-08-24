// ui/form.js — render a module's input form from its formSpec() descriptor and
// read the values back out. UI layer (touches DOM). No app logic here.

import { el, clear } from './dom.js';

/**
 * Render a form for the given module into `container`.
 * @param {HTMLElement} container
 * @param {any} mod  a registry module (has title + formSpec())
 * @param {(input:Object)=>void} onRun  called with collected field values
 * @param {()=>void} [onClose]
 * @returns {{ read:()=>Object }}
 */
export function renderForm(container, mod, onRun, onClose) {
  clear(container);
  const spec = mod.formSpec ? mod.formSpec() : { fields: [], examples: [] };
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  const examples = Array.isArray(spec.examples) ? spec.examples : [];

  const inputs = {};
  const form = el('form', { class: 'checkform', attrs: { 'data-module-form': mod.id } });

  form.append(el('h2', { class: 'checkform__title', text: mod.title }));
  if (mod.tagline) form.append(el('p', { class: 'checkform__tagline', text: mod.tagline }));

  for (const field of fields) {
    const id = `field-${mod.id}-${field.name}`;
    const label = el('label', { class: 'checkform__label', text: field.label, attrs: { for: id } });
    let input;
    if (field.type === 'textarea') {
      input = el('textarea', {
        class: 'checkform__input checkform__input--area',
        attrs: { id, name: field.name, placeholder: field.placeholder || '', rows: '8' },
      });
    } else if (field.type === 'checkbox') {
      input = el('input', { class: 'checkform__check', attrs: { id, name: field.name, type: 'checkbox' } });
    } else {
      input = el('input', {
        class: 'checkform__input',
        attrs: { id, name: field.name, type: field.type || 'text', placeholder: field.placeholder || '' },
      });
    }
    inputs[field.name] = { input, type: field.type };
    const group = el('div', { class: 'checkform__group' }, [label, input]);
    if (field.help) group.append(el('p', { class: 'checkform__help', text: field.help }));
    form.append(group);
  }

  const read = () => {
    const out = {};
    for (const [name, { input, type }] of Object.entries(inputs)) {
      out[name] = type === 'checkbox' ? input.checked : input.value;
    }
    return out;
  };

  if (examples.length) {
    const exRow = el('div', { class: 'checkform__examples' }, [
      el('span', { class: 'checkform__examples-label', text: 'Try an example:' }),
    ]);
    for (const ex of examples) {
      exRow.append(
        el('button', {
          class: 'checkform__example',
          text: ex.label,
          attrs: { type: 'button' },
          on: {
            click: () => {
              for (const [name, { input, type }] of Object.entries(inputs)) {
                const v = ex.value ? ex.value[name] : undefined;
                if (v == null) continue;
                if (type === 'checkbox') input.checked = Boolean(v);
                else input.value = String(v);
              }
            },
          },
        }),
      );
    }
    form.append(exRow);
  }

  const actions = el('div', { class: 'checkform__actions' }, [
    el('button', {
      class: 'btn btn--primary',
      text: 'Check it',
      attrs: { type: 'submit' },
    }),
  ]);
  if (onClose) {
    actions.append(
      el('button', { class: 'btn btn--ghost', text: 'Back', attrs: { type: 'button' }, on: { click: onClose } }),
    );
  }
  form.append(actions);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onRun(read());
  });

  container.append(form);
  return { read };
}
