// train-agent-trace — reformat multi-turn tool-use sessions into training examples
// with explicit tool tokens. Used by train-self --mode agent-trace.
//
// Output format (one example per completed trajectory):
//   {"messages": [
//     {"role":"user","content":"..."},
//     {"role":"assistant","content":"<think>...</think><tool>name</tool><args>{...}</args>"},
//     {"role":"tool","content":"<result>...</result>"},
//     {"role":"assistant","content":"<think>...</think><answer>...</answer>"}
//   ]}
//
// Tool tokens we inject:
//   <think>...</think>   — reasoning
//   <tool>name</tool>    — tool selected
//   <args>{...}</args>   — JSON arguments
//   <result>...</result> — tool output (truncated)
//   <answer>...</answer> — final assistant turn
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export const TOOL_TOKENS = {
    think_open: '<think>', think_close: '</think>',
    tool_open: '<tool>', tool_close: '</tool>',
    args_open: '<args>', args_close: '</args>',
    result_open: '<result>', result_close: '</result>',
    answer_open: '<answer>', answer_close: '</answer>',
};
function truncate(s, n) {
    if (s.length <= n)
        return s;
    return s.slice(0, n) + ` …[+${s.length - n} chars]`;
}
/** Build an assistant turn with think + tool call tokens. */
function assistantToolTurn(thinking, toolName, args) {
    const thinkPart = thinking
        ? `${TOOL_TOKENS.think_open}${thinking.trim()}${TOOL_TOKENS.think_close}\n`
        : '';
    const argsJson = JSON.stringify(args);
    return `${thinkPart}${TOOL_TOKENS.tool_open}${toolName}${TOOL_TOKENS.tool_close}\n${TOOL_TOKENS.args_open}${argsJson}${TOOL_TOKENS.args_close}`;
}
/** Build a tool-result turn. */
function toolResultTurn(result, maxLen) {
    return `${TOOL_TOKENS.result_open}${truncate(result, maxLen)}${TOOL_TOKENS.result_close}`;
}
/** Build the final assistant answer turn. */
function answerTurn(thinking, content) {
    const thinkPart = thinking
        ? `${TOOL_TOKENS.think_open}${thinking.trim()}${TOOL_TOKENS.think_close}\n`
        : '';
    return `${thinkPart}${TOOL_TOKENS.answer_open}${content.trim()}${TOOL_TOKENS.answer_close}`;
}
/** Convert one teacher trace into an agent-trace example. */
function formatTrace(t, maxResult) {
    const toolCalls = t.response.tool_calls || [];
    if (toolCalls.length === 0)
        return null;
    const messages = [];
    // Seed with conversation context (excluding the final assistant turn)
    for (const m of t.messages) {
        if (m.role === 'user' || m.role === 'system') {
            messages.push({ role: m.role, content: m.content });
        }
    }
    // Inject assistant tool-call turn
    const firstCall = toolCalls[0];
    messages.push({
        role: 'assistant',
        content: assistantToolTurn(t.response.thinking || '', firstCall.name, firstCall.arguments),
    });
    // We don't have the actual tool result in teacher traces — synthesize a placeholder
    // that the model can learn to parse. In production, the tool executor would fill this
    // when replaying recorded sessions.
    messages.push({
        role: 'tool',
        content: toolResultTurn('[result from ' + firstCall.name + ']', maxResult),
    });
    // Final answer
    messages.push({
        role: 'assistant',
        content: answerTurn('', t.response.content),
    });
    return {
        messages,
        _tool_count: toolCalls.length,
        _trace_id: t.id,
    };
}
export function formatAgentTraces(opts = {}) {
    const input = opts.input ?? join(homedir(), '.kbot', 'teacher', 'traces.jsonl');
    const output = opts.output ?? join(homedir(), '.kbot', 'teacher', 'dataset-agent-trace.jsonl');
    const minTools = opts.minTools ?? 1;
    const maxResult = opts.maxResultLen ?? 1200;
    const result = {
        output,
        trajectories: 0,
        examples: 0,
        skipped_no_tools: 0,
        skipped_errors: 0,
    };
    if (!existsSync(input))
        return result;
    // Truncate output
    writeFileSync(output, '');
    const lines = readFileSync(input, 'utf-8').split('\n').filter(l => l.trim());
    for (const line of lines) {
        try {
            const t = JSON.parse(line);
            result.trajectories++;
            if (opts.verifiedOnly && !t.outcome?.verified) {
                result.skipped_errors++;
                continue;
            }
            const toolCount = t.response.tool_calls?.length || 0;
            if (toolCount < minTools) {
                result.skipped_no_tools++;
                continue;
            }
            const ex = formatTrace(t, maxResult);
            if (ex) {
                appendFileSync(output, JSON.stringify(ex) + '\n');
                result.examples++;
            }
        }
        catch {
            result.skipped_errors++;
        }
    }
    return result;
}
export function formatAgentTraceReport(r) {
    return [
        'agent-trace formatter',
        '─'.repeat(40),
        `  Output:             ${r.output}`,
        `  Trajectories seen:  ${r.trajectories}`,
        `  Examples emitted:   ${r.examples}`,
        `  Skipped (no tools): ${r.skipped_no_tools}`,
        `  Skipped (errors):   ${r.skipped_errors}`,
    ].join('\n');
}
//# sourceMappingURL=train-agent-trace.js.map