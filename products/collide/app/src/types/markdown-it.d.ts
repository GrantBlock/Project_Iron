// The part of markdown-it (approved dependency, RUN3 T34) that src/markdown/render.ts uses. A local declaration
// instead of @types/markdown-it, which is not on the approved list.
declare module "markdown-it" {
  interface Token {
    attrGet(name: string): string | null;
    children: Token[] | null;
  }
  interface Options {
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- env is whatever render() was given
  type Env = any;
  interface Renderer {
    rules: Record<string, ((tokens: Token[], idx: number, options: Options, env: Env, self: Renderer) => string) | undefined>;
    renderInlineAsText(tokens: Token[], options: Options, env: unknown): string;
  }
  class MarkdownIt {
    constructor(options?: Options);
    renderer: Renderer;
    utils: { escapeHtml(s: string): string };
    render(src: string, env?: unknown): string;
  }
  export default MarkdownIt;
}
