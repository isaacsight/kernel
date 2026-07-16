import{g as _}from"./registry-jHMfcwPx.js";const v=5,T=/```tool_call\s*\n([\s\S]*?)\n```/g;function w(t){return t.length===0?"":`

You have access to the following tools. To use a tool, include a tool_call code block in your response:

\`\`\`tool_call
{"name": "tool_name", "args": {"param": "value"}}
\`\`\`

Available tools:

${t.map(e=>{const n=Object.entries(e.parameters).map(([r,u])=>`  - ${r}: ${JSON.stringify(u)}`).join(`
`);return`## ${e.name}
${e.description}
Parameters:
${n}`}).join(`

`)}

After a tool returns its result, continue your response incorporating the result. Only call one tool at a time. If you don't need a tool, just respond normally without any tool_call blocks.`}function C(t){const o=[];let e;const n=new RegExp(T.source,"g");for(;(e=n.exec(t))!==null;)try{const r=JSON.parse(e[1]);r.name&&o.push({id:`tc_${Date.now()}_${o.length}`,name:r.name,args:r.args||{}})}catch{}return o}function S(t){return t.replace(T,"").trim()}async function A(t,o,e){if(t.requiresApproval&&e.onApprovalNeeded){const n=`${t.name}(${JSON.stringify(o)})`;if(!await e.onApprovalNeeded(t.name,o,n))return{success:!1,data:null,error:"User rejected this action"}}try{return await t.execute(o)}catch(n){return{success:!1,data:null,error:n instanceof Error?n.message:"Tool execution failed"}}}async function L(t,o,e={},n){var d;const r=(n==null?void 0:n.maxTurns)??v,u=[],$=w(o),x={...n,system:((n==null?void 0:n.system)||"")+$};let l=[...t],m="";for(let f=0;f<r;f++){let p="";const i=await _().streamChat(l,a=>{var y;p=a,(y=e.onChunk)==null||y.call(e,a)},x)||p,g=C(i);if(g.length===0){m=i;break}const s=g[0],h=o.find(a=>a.name===s.name);if(!h){l=[...l,{role:"assistant",content:i},{role:"user",content:`Tool "${s.name}" not found. Available tools: ${o.map(a=>a.name).join(", ")}. Please try again or respond without tools.`}];continue}(d=e.onToolCall)==null||d.call(e,s.name,s.args);const c=await A(h,s.args,e);u.push({id:s.id,result:c});const O=c.success?`Tool "${s.name}" result:
${JSON.stringify(c.data,null,2)}`:`Tool "${s.name}" failed: ${c.error}`;l=[...l,{role:"assistant",content:i},{role:"user",content:O}],m=S(i)}return{text:m,toolCalls:u}}export{L as r};
