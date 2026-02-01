// ---------------------------------------------------------------------------
// Script compilation — wraps user source into a callable function
// ---------------------------------------------------------------------------

export interface CompiledScript {
  fn: (self: any, ctx: any) => void;
}

export interface ScriptError {
  nodeId: string;
  phase: 'compile' | 'runtime';
  message: string;
  stack?: string;
}

export function compileScript(source: string, nodeId: string): CompiledScript | ScriptError {
  try {
    const fn = new Function('self', 'ctx', source) as (self: any, ctx: any) => void;
    return { fn };
  } catch (err: any) {
    return {
      nodeId,
      phase: 'compile',
      message: err.message ?? String(err),
      stack: err.stack,
    };
  }
}

export function isScriptError(result: CompiledScript | ScriptError): result is ScriptError {
  return 'phase' in result;
}
