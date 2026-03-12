var k=Object.defineProperty;var D=(t,e,i)=>e in t?k(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i;var p=(t,e,i)=>D(t,typeof e!="symbol"?e+"":e,i);import{k as w}from"./index-emi1eDLY.js";import{g as _}from"./specialists-CvW2zJzb.js";import{D as P}from"./types-HNEMhIRw.js";import"./vendor-i18n-DBJnNzII.js";import"./vendor-react-C1MACuvJ.js";import"./vendor-ui-BpP1nP3I.js";import"./vendor-supabase-yKjPlrCh.js";import"./kernel-DdbE7gjV.js";function R(t,e){return`Rate the topic-audience fit of this content on a scale of 0.0 to 1.0.

Title: ${t.title||"(untitled)"}
Format: ${t.format}
Brief: ${t.brief}
Content preview: ${(t.finalContent||"").slice(0,1500)}

User context (voice, interests, audience):
${e.slice(0,1e3)}

Consider:
- How well does this topic match the user's typical content themes?
- Would their audience find this relevant and valuable?
- Is the angle specific enough to be interesting?

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`}function S(t){return`Rate the quality of this content on a scale of 0.0 to 1.0.

Title: ${t.title||"(untitled)"}
Format: ${t.format}
Content: ${(t.finalContent||"").slice(0,3e3)}

Evaluate:
- Structure and flow (logical progression, clear sections)
- Language quality (vivid, precise, no filler)
- Depth of insight (beyond surface-level observations)
- Opening hook strength
- Actionable value for the reader

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`}function A(t,e){return`Rate how well this content matches the user's personal voice and style on a scale of 0.0 to 1.0.

Content preview: ${(t.finalContent||"").slice(0,2e3)}

User's voice profile:
${e.slice(0,1e3)}

Consider:
- Tone alignment (formal/casual, serious/witty, analytical/narrative)
- Vocabulary and phrasing patterns
- Perspective and worldview consistency
- Would readers recognize this as coming from this creator?

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`}function T(t,e){return`Rate how well this content aligns with current trends on a scale of 0.0 to 1.0.

Title: ${t.title||"(untitled)"}
Topic: ${t.brief}
Tags: ${t.tags.join(", ")}

Current trend signals:
${e.slice(0,1500)}

Consider:
- Is this topic currently trending or gaining interest?
- Does it connect to broader cultural or industry conversations?
- Is the timing right for this content?

Return ONLY valid JSON: { "score": 0.XX, "reasoning": "one sentence" }`}function O(t){const e=(Date.now()-t)/36e5;return Math.exp(-.015*e)}function x(t,e){const i=e.dimensions.map(n=>`${n.dimension}: ${n.score.toFixed(2)} (${n.reasoning||""})`).join(`
`);return`Recommend distribution platforms for this content.

Title: ${t.title||"(untitled)"}
Format: ${t.format}
Tags: ${t.tags.join(", ")}
Composite score: ${e.composite.toFixed(2)}

Dimension breakdown:
${i}

Content preview: ${(t.finalContent||"").slice(0,1e3)}

For each recommended platform (blog, twitter, linkedin, newsletter, medium, substack), provide:
1. Platform-specific optimization score (0.0-1.0)
2. Why this platform fits
3. Best posting time (general guidance)
4. Format adaptation notes

Return ONLY valid JSON:
{
  "targets": [
    { "platform": "twitter", "score": 0.XX, "reasoning": "...", "bestTime": "...", "formatNotes": "..." }
  ]
}`}class Y{constructor(e,i){p(this,"weights");p(this,"learningRate");this.callbacks=i,this.weights=(e==null?void 0:e.weights)||{...P},this.learningRate=(e==null?void 0:e.learningRate)||.1}getWeights(){return{...this.weights}}async collectSignals(e,i){var s,o;(o=(s=this.callbacks)==null?void 0:s.onProgress)==null||o.call(s,"Collecting signals","Gathering context for scoring...");const n=[];n.push({type:"topic_fit",data:`Brief: ${e.brief}. Format: ${e.format}. Tags: ${e.tags.join(", ")}`,confidence:.9,source:"content_metadata"}),i&&n.push({type:"audience_match",data:i.slice(0,500),confidence:.8,source:"user_memory"}),n.push({type:"voice_alignment",data:i.slice(0,500),confidence:.7,source:"user_memory"});const r=e.finalContent||"";n.push({type:"quality_markers",data:`Length: ${r.length} chars. Sections: ${(r.match(/^#+\s/gm)||[]).length}. Has examples: ${/example|case study|for instance/i.test(r)}`,confidence:.85,source:"content_analysis"});try{const l=`${e.title||e.brief} trends ${new Date().getFullYear()}`,c=await w().text(`Search for current trends related to: ${l}. Summarize in 3-4 sentences what the current discourse looks like.`,{tier:"fast",max_tokens:300,web_search:!0,feature:"algorithm_scoring"});n.push({type:"trend_data",data:c,confidence:.6,source:"web_search"})}catch{n.push({type:"trend_data",data:"Trend data unavailable",confidence:.3,source:"fallback"})}return n}async score(e,i,n){var u,y,b,d,v;(y=(u=this.callbacks)==null?void 0:u.onProgress)==null||y.call(u,"Scoring","Evaluating content across 5 dimensions...");const r=((b=i.find(f=>f.type==="trend_data"))==null?void 0:b.data)||"",[s,o,l,c]=await Promise.all([this.evaluateDimension("relevance",R(e,n)),this.evaluateDimension("quality",S(e)),this.evaluateDimension("userAffinity",A(e,n)),this.evaluateDimension("trendAlignment",T(e,r))]),h={dimension:"freshness",score:O(e.createdAt),weight:this.weights.freshness,reasoning:`Content is ${Math.round((Date.now()-e.createdAt)/(1e3*60*60))}h old`},g=[{...s,weight:this.weights.relevance},{...o,weight:this.weights.quality},{...l,weight:this.weights.userAffinity},h,{...c,weight:this.weights.trendAlignment}],a=g.reduce((f,$)=>f+$.score*$.weight,0),m={contentId:e.id,composite:a,dimensions:g,scoredAt:Date.now()};return(v=(d=this.callbacks)==null?void 0:d.onScoreUpdate)==null||v.call(d,m),m}async evaluateDimension(e,i){try{const n=await w().json(i,{tier:"fast",max_tokens:150,feature:"algorithm_scoring"});return{dimension:e,score:Math.max(0,Math.min(1,n.score||0)),weight:this.weights[e],reasoning:n.reasoning||""}}catch{return{dimension:e,score:.5,weight:this.weights[e],reasoning:"Evaluation failed — using neutral score"}}}async rank(e){var n,r;(r=(n=this.callbacks)==null?void 0:n.onProgress)==null||r.call(n,"Ranking",`Ranking ${e.length} content items...`);const i=[];for(const s of e){const o=await this.collectSignals(s,""),l=await this.score(s,o,"");i.push({item:s,composite:l.composite})}return i.sort((s,o)=>o.composite-s.composite),i.map(s=>s.item)}async recommendDistribution(e,i){var s,o;(o=(s=this.callbacks)==null?void 0:s.onProgress)==null||o.call(s,"Distribution","Recommending distribution platforms...");const n=_("strategist"),r=x(e,i);try{return((await w().json(r,{system:n.systemPrompt,tier:"fast",max_tokens:600,feature:"algorithm_scoring"})).targets||[]).map(c=>({platform:c.platform,score:Math.max(0,Math.min(1,c.score||0)),reasoning:c.reasoning||"",bestTime:c.bestTime,formatNotes:c.formatNotes}))}catch{return[]}}async processFeedback(e,i,n){var h,g;(g=(h=this.callbacks)==null?void 0:h.onProgress)==null||g.call(h,"Feedback","Processing performance data...");const r=n.length;if(r===0)return{contentId:e,predictedScore:i.composite,actualPerformance:0,weightDelta:{relevance:0,quality:0,userAffinity:0,freshness:0,trendAlignment:0},createdAt:Date.now()};const s=Math.min(1,n.reduce((a,m)=>a+m.value,0)/r),o=s-i.composite,l={relevance:0,quality:0,userAffinity:0,freshness:0,trendAlignment:0};for(const a of i.dimensions){const m=o*(a.score-i.composite),u=this.learningRate*m;l[a.dimension]=u,this.weights[a.dimension]=Math.max(.05,Math.min(.5,this.weights[a.dimension]+u))}const c=Object.values(this.weights).reduce((a,m)=>a+m,0);for(const a of Object.keys(this.weights))this.weights[a]/=c;return{contentId:e,predictedScore:i.composite,actualPerformance:s,weightDelta:l,createdAt:Date.now()}}}export{Y as AlgorithmEngine};
