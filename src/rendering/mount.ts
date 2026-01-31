import { runComponent, disposeComponent, type ComponentFunction, type ComponentInstance } from './component.js';
import { insertChild } from './dom.js';

export function mount(component: ComponentFunction, container: Element): () => void {
  container.textContent = '';
  const instance = runComponent(component, {});
  insertChild(container, instance.result as any);

  return () => {
    disposeComponent(instance);
    container.textContent = '';
  };
}
