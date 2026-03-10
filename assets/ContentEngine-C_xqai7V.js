var f=Object.defineProperty;var b=(p,t,e)=>t in p?f(p,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):p[t]=e;var u=(p,t,e)=>b(p,typeof t!="symbol"?t+"":t,e);import{j as h}from"./index-BTbIVYx5.js";import{g as d}from"./specialists-6lvObvl4.js";import{S as g}from"./types-HNEMhIRw.js";import"./vendor-i18n-DBJnNzII.js";import"./vendor-react-C1MACuvJ.js";import"./vendor-ui-BpP1nP3I.js";import"./vendor-supabase-yKjPlrCh.js";import"./kernel-3WPdhrUt.js";function y(p,t,e,s,i){const r=Object.entries(s).map(([c,o])=>`## ${c.charAt(0).toUpperCase()+c.slice(1)} Output
${o}`).join(`

`),n=i?`

User feedback on previous stage:
${i}`:"",a=e.replace(/_/g," ");switch(p){case"ideation":return`You are brainstorming content ideas for a ${a}.

Brief: ${t}
${n}

Generate 3-5 creative angles for this content. For each angle:
1. A compelling title/hook
2. The core thesis (1-2 sentences)
3. Why this angle would resonate with the target audience
4. Key differentiator from typical content on this topic

Be bold and creative. Avoid generic angles — find the unexpected insight.`;case"research":return`Research the following topic thoroughly for a ${a}.

Brief: ${t}

${r}
${n}

Gather key facts, statistics, expert perspectives, and supporting evidence. Focus on:
1. Current data and trends (cite sources where possible)
2. Expert opinions and contrarian viewpoints
3. Real examples and case studies
4. Common misconceptions to address

Organize findings by theme. Be thorough but concise.`;case"outline":return`Create a detailed structural outline for a ${a}.

Brief: ${t}

${r}
${n}

Build a clear outline with:
1. Working title (based on the chosen angle)
2. Hook/opening strategy
3. Section-by-section breakdown with key points for each
4. Transitions between sections
5. Call-to-action or closing strategy
6. Estimated word count per section

The outline should flow logically and build toward a clear conclusion.`;case"draft":return`Write the full ${a} based on the outline and research.

Brief: ${t}

${r}
${n}

Write the complete content following the outline structure. Guidelines:
- Write in a natural, engaging voice
- Weave in research findings and data naturally
- Use concrete examples and vivid language
- Keep paragraphs short and scannable
- Include a strong opening hook and memorable closing
- Match the tone and style appropriate for the format

Produce the full piece — do not summarize or truncate.`;case"edit":return`Edit and polish this ${a} for publication quality.

Brief: ${t}

${r}
${n}

Review and improve:
1. **Clarity**: Simplify complex sentences, eliminate jargon
2. **Flow**: Smooth transitions, logical progression
3. **Voice**: Consistent tone, authentic personality
4. **Impact**: Stronger opening, punchier closing, sharper insights
5. **Concision**: Cut filler words, redundant phrases, weak qualifiers
6. **Accuracy**: Verify claims match the research

Output the full edited piece with tracked changes noted in [brackets] for significant edits.`;case"publish":return`Prepare this ${a} for distribution.

Brief: ${t}

${r}
${n}

Provide:
1. **Final title** (optimized for the platform)
2. **Meta description** (150 chars max)
3. **Tags/keywords** (5-8 relevant terms)
4. **Platform-specific recommendations**: formatting tips, ideal length, hashtags
5. **Distribution strategy**: best platforms, timing suggestions, audience targeting
6. **Social excerpts**: 2-3 ready-to-post promotional snippets

Make recommendations specific and actionable.`}}function w(p,t,e,s,i){return`You are reviewing stage output for a ${i.replace(/_/g," ")} content pipeline.

Stage: ${p}
Brief: ${s}

Primary agent output:
${e.slice(0,3e3)}

Provide a brief (2-4 sentences) perspective from your specialization. Flag any gaps, suggest improvements, or highlight strengths. Be specific and actionable.`}class C{constructor(t,e,s){u(this,"state","idle");u(this,"cancelled",!1);u(this,"stages",[]);u(this,"stageOutputs",{});u(this,"contentId");this.brief=t,this.format=e,this.callbacks=s,this.contentId=crypto.randomUUID(),this.stages=g.map(i=>({stage:i.stage,status:"pending"}))}get id(){return this.contentId}getStages(){return[...this.stages]}getState(){return this.state}cancel(){this.cancelled=!0,this.state="cancelled",this.emit("ideation","failed","Pipeline cancelled by user")}async start(){return this.state="running",this.runFrom("ideation")}async resumeFrom(t,e){const s=this.stages.find(a=>a.stage===t);s&&e&&(s.userFeedback=e),(s==null?void 0:s.status)==="awaiting_approval"&&(s.status="approved",s.completedAt=Date.now()),this.updateStages();const i=["ideation","research","outline","draft","edit","publish"],r=i.indexOf(t),n=i[r+1];return n?(this.state="running",this.runFrom(n)):this.buildResult()}async runFrom(t){var i,r;const e=["ideation","research","outline","draft","edit","publish"],s=e.indexOf(t);for(let n=s;n<e.length&&!this.cancelled;n++){const a=e[n],c=g.find(l=>l.stage===a),o=this.stages.find(l=>l.stage===a);o.status="active",o.startedAt=Date.now(),this.updateStages(),this.emit(a,"active",`Running ${a}...`);try{const l=await this.runPrimaryAgent(a,c);if(o.output=l,this.stageOutputs[a]=l,c.supportAgents.length>0){const m=await this.runSupportAgents(a,c,l);o.supportOutputs=m}if(!c.autoApprove)return o.status="awaiting_approval",this.state="awaiting_approval",this.updateStages(),this.emit(a,"awaiting_approval",`${a} complete — awaiting approval`),(r=(i=this.callbacks).onApprovalNeeded)==null||r.call(i,a,l),this.buildResult();o.status="approved",o.completedAt=Date.now(),this.updateStages(),this.emit(a,"approved",`${a} auto-approved`)}catch(l){return o.status="failed",o.error=l instanceof Error?l.message:"Unknown error",this.state="failed",this.updateStages(),this.emit(a,"failed",o.error),this.buildResult()}}return this.state="completed",this.emit("publish","approved","Pipeline complete"),this.buildResult()}async runPrimaryAgent(t,e){var n;const s=d(e.primaryAgent),i=y(t,this.brief,this.format,this.stageOutputs,(n=this.stages.find(a=>a.stage===t))==null?void 0:n.userFeedback);let r="";return await h().stream(i,a=>{var c,o;r=a,(o=(c=this.callbacks).onChunk)==null||o.call(c,a)},{system:s.systemPrompt,tier:t==="research"?"fast":"strong",max_tokens:e.maxTokens,web_search:t==="research",feature:"content_pipeline"}),r}async runSupportAgents(t,e,s){const i={};return await Promise.all(e.supportAgents.map(async r=>{try{const n=d(r),a=w(t,r,s,this.brief,this.format),c=await h().text(a,{system:n.systemPrompt,tier:"fast",max_tokens:300,feature:"content_pipeline"});i[r]=c}catch{i[r]="(support agent unavailable)"}})),i}emit(t,e,s){const i={type:"content_progress",stage:t,status:e,details:s,timestamp:Date.now()};this.callbacks.onProgress(i)}updateStages(){var t,e;(e=(t=this.callbacks).onStageUpdate)==null||e.call(t,[...this.stages])}buildResult(){var t;return this.stageOutputs.publish,{id:this.contentId,userId:"",brief:this.brief,format:this.format,title:this.extractTitle(),tags:this.extractTags(),currentStage:this.getCurrentStage(),stages:[...this.stages],finalContent:this.stageOutputs.edit||this.stageOutputs.draft||"",createdAt:((t=this.stages[0])==null?void 0:t.startedAt)||Date.now(),updatedAt:Date.now()}}getCurrentStage(){const t=this.stages.find(s=>s.status==="active"||s.status==="awaiting_approval");if(t)return t.stage;const e=[...this.stages].reverse().find(s=>s.status==="approved");return(e==null?void 0:e.stage)||"ideation"}extractTitle(){var s;const e=(this.stageOutputs.outline||"").match(/(?:title|working title)[:\s]*["""']?([^\n"'"]+)/i);return(s=e==null?void 0:e[1])==null?void 0:s.trim()}extractTags(){const e=(this.stageOutputs.publish||"").match(/(?:tags|keywords)[:\s]*([^\n]+)/i);return e?e[1].split(/[,;]/).map(s=>s.replace(/[#"']/g,"").trim()).filter(Boolean).slice(0,8):[]}}export{C as ContentEngine};
