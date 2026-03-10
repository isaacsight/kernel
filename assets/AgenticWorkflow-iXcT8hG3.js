var w=Object.defineProperty;var y=(c,t,e)=>t in c?w(c,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):c[t]=e;var u=(c,t,e)=>y(c,typeof t!="symbol"?t+"":t,e);import{j as p,l as g}from"./index-8fSL7U6h.js";import"./vendor-i18n-DBJnNzII.js";import"./vendor-react-C1MACuvJ.js";import"./vendor-ui-BpP1nP3I.js";import"./vendor-supabase-yKjPlrCh.js";const S="https://eoxxpyixdieprsxlpwcs.supabase.co",k="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveHhweWl4ZGllcHJzeGxwd2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzYzMzQsImV4cCI6MjA4NjUxMjMzNH0.5dN2-jBbzJ1-2TV-1DMCwfAMg2FdIxlbJdJMbUF7IE8";async function f(c,t){const e=await g(),a=await fetch(`${S}/functions/v1/${c}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e}`,apikey:k},body:JSON.stringify(t)});if(!a.ok){const r=await a.text();throw new Error(`${c} failed (${a.status}): ${r}`)}return a.json()}const $=[{name:"web_search",description:"Search the web for current information on a topic"},{name:"url_fetch",description:"Fetch and extract text content from a specific URL"},{name:"analyze",description:"Analyze and reason about gathered information using AI"},{name:"draft",description:"Write or create content based on research and analysis"}];async function b(c,t,e){switch(c){case"web_search":{const a=await f("web-search",{query:t,max_tokens:1200}),r=a.text||"",n=a.citations||[];return n.length>0?`${r}

Sources:
${n.map(i=>`- ${i}`).join(`
`)}`:r}case"url_fetch":{const a=t.match(/https?:\/\/[^\s"'<>)\]]+/i);return a?(await f("url-fetch",{url:a[0]})).text||`Failed to fetch content from ${a[0]}`:`No valid URL found in input. Available context: ${t.slice(0,200)}`}case"analyze":return await p().text(t,{system:e||"You are an analytical thinker. Analyze the provided information thoroughly. Identify key themes, patterns, and actionable insights. Be concise but comprehensive.",tier:"strong",max_tokens:2048,feature:"workflow"});case"draft":return await p().text(t,{system:e||"You are an expert writer. Draft the requested content based on the provided research and context. Write clearly, concisely, and professionally.",tier:"strong",max_tokens:4096,feature:"workflow"})}}const d=2,x=3,m=7;class N{constructor(t,e){u(this,"state","planning");u(this,"cancelled",!1);u(this,"steps",[]);this._agentSystemPrompt=t,this.callbacks=e}cancel(){this.cancelled=!0,this.state="cancelled"}getSteps(){return[...this.steps]}emit(t,e){this.callbacks.onProgress({type:"workflow_progress",state:this.state,step:t,details:e,timestamp:Date.now()})}updateSteps(){var t,e;(e=(t=this.callbacks).onStepsUpdate)==null||e.call(t,[...this.steps])}async plan(t,e){this.state="planning",this.emit("Planning","Decomposing goal into concrete steps...");const a=$.map(n=>`- ${n.name}: ${n.description}`).join(`
`),r=`You are a task planner. Break down this goal into ${x}-${m} concrete, actionable steps.

Goal: ${t}

Context from conversation:
${e}

Available tools for each step:
${a}

For each step, specify:
1. A clear, concise step name (e.g., "Search for AI safety papers from 2024")
2. Which tool to use (web_search, url_fetch, analyze, or draft)
3. The input/query for that tool

Return ONLY valid JSON with this structure:
{
  "steps": [
    { "name": "Step description", "tool": "tool_name", "input": "query or instruction for the tool" }
  ]
}

Rules:
- Use web_search for finding current information
- Use url_fetch to get content from specific URLs found during search
- Use analyze to reason about gathered data
- Use draft to write final content
- Steps should build on each other logically
- Be specific in step names and inputs`;try{const n=await p().json(r,{system:"You are a task planning expert. Output ONLY valid JSON.",tier:"fast",max_tokens:1024,feature:"workflow"});if(!n.steps||!Array.isArray(n.steps)||n.steps.length===0)throw new Error("No steps returned");const i=n.steps.slice(0,m);return this.steps=i.map(s=>({name:s.name,status:"pending"})),this.updateSteps(),i.map(s=>JSON.stringify(s))}catch{const n={name:t,tool:"analyze",input:t};return this.steps=[{name:t,status:"pending"}],this.updateSteps(),[JSON.stringify(n)]}}async executeStep(t,e,a){let r;try{r=JSON.parse(t)}catch{return`Failed to parse step: ${t}`}this.steps[e].status="active",this.updateSteps(),this.state="executing",this.emit(`Step ${e+1}/${this.steps.length}`,r.name);const n=r.tool==="web_search"?r.input:`${r.input}

Context from previous steps:
${a}`;let i="";for(let s=0;s<=d;s++){if(this.cancelled)return this.steps[e].status="skipped",this.steps[e].error="Cancelled",this.updateSteps(),"";try{const o=await b(r.tool,s>0?`${n}

(Retry ${s}: previous attempt failed with: ${i})`:n,this._agentSystemPrompt);if(this.state="observing",this.emit("Evaluating",`Checking result of: ${r.name}`),await this.evaluateStepResult(r.name,o)||s===d)return this.steps[e].status="complete",this.steps[e].result=o.slice(0,500),this.updateSteps(),o;i="Result did not adequately satisfy the step requirements"}catch(o){if(i=o instanceof Error?o.message:"Unknown error",s===d)return this.steps[e].status="failed",this.steps[e].error=i,this.updateSteps(),`[Step failed: ${i}]`}}return""}async evaluateStepResult(t,e){if(e.length>100&&!e.startsWith("[Step failed"))return!0;try{return(await p().json(`Step: "${t}"

Result:
${e.slice(0,1e3)}

Did this step produce an adequate result? Return { "adequate": true/false, "reason": "brief explanation" }`,{system:"You are a quality evaluator. Judge whether the step result is adequate. Output ONLY valid JSON.",tier:"fast",max_tokens:256,feature:"workflow"})).adequate??!0}catch{return!0}}async synthesize(t,e){const a=e.map((i,s)=>`## Step ${s+1}: ${i.name}
${i.result}`).join(`

---

`),r=`You completed a multi-step workflow for the user. Here is what was accomplished:

**Original Goal:** ${t}

**Step Results:**
${a}

**Instructions:**
- Synthesize all step results into a cohesive, well-structured final response
- Address the original goal directly
- If any steps failed, note what couldn't be completed and why
- Include relevant sources, URLs, or citations from the research steps
- Write naturally as if presenting findings to the user
- Do NOT mention "steps" or "workflow" — just present the final result`;let n="";return await p().stream(r,i=>{var s,o;n=i,(o=(s=this.callbacks).onChunk)==null||o.call(s,i)},{system:this._agentSystemPrompt,tier:"strong",max_tokens:8192,feature:"workflow"}),n}async execute(t,e){this.cancelled=!1;const a=await this.plan(t,e);if(this.cancelled)return this.state="cancelled",this.emit("Cancelled","Workflow was cancelled during planning"),"*Workflow cancelled.*";this.state="executing",this.emit("Plan ready",`${this.steps.length} steps to execute`);let r=e;const n=[];for(let s=0;s<a.length;s++){if(this.cancelled){for(let h=s;h<this.steps.length;h++)this.steps[h].status="skipped";this.updateSteps();break}const o=await this.executeStep(a[s],s,r);let l;try{l=JSON.parse(a[s])}catch{l={name:`Step ${s+1}`}}o&&!this.cancelled&&(r+=`

--- Step ${s+1} (${l.name}) ---
${o}`,n.push({name:l.name,result:o}))}if(this.cancelled)return this.state="cancelled",this.emit("Cancelled","Workflow was cancelled"),n.length>0?this.synthesize(t,n):"*Workflow cancelled before producing results.*";this.state="executing",this.emit("Synthesizing","Combining results into final response...");const i=await this.synthesize(t,n);return this.state="completed",this.emit("Complete","Workflow finished successfully"),this.steps.forEach(s=>{s.status==="active"&&(s.status="complete")}),this.updateSteps(),i}}export{N as AgenticWorkflow};
