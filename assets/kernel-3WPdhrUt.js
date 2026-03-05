const r=[{pattern:/\b(?:i\s+)?want\s+to\s+(?:kill|end|hurt)\s+my\s*self\b/i,label:"explicit-intent"},{pattern:/\b(?:i'm\s+going\s+to|i\s+will|i\s+plan\s+to)\s+(?:kill|end|hurt)\s+my\s*self\b/i,label:"explicit-plan"},{pattern:/\bhow\s+(?:to|do\s+(?:i|you))\s+(?:kill|end)\s+(?:my\s*self|your\s*self|one\s*self)\b/i,label:"method-seeking"},{pattern:/\bi\s+don'?t\s+want\s+to\s+(?:be\s+alive|live|exist)\b/i,label:"death-wish"},{pattern:/\bi'?m?\s+(?:going\s+to|gonna)\s+(?:end\s+it\s+(?:all|tonight|today|now)|take\s+my\s+(?:own\s+)?life)\b/i,label:"explicit-plan"},{pattern:/\b(?:i\s+)?(?:want|need|plan|ready)\s+to\s+(?:die|end\s+(?:it|my\s+life|everything))\b/i,label:"explicit-intent"},{pattern:/\bsuicid(?:e|al)\b/i,label:"suicidal-reference"},{pattern:/\bi'?m?\s+(?:better\s+off\s+dead|a\s+burden\s+to\s+every(?:one|body))\b/i,label:"burden-belief"}],l=[{pattern:/\bnobody\s+would\s+(?:miss|care|notice)\b/i,label:"perceived-burdensomeness"},{pattern:/\bi\s+can'?t\s+(?:do\s+this|take\s+(?:it|this)|go\s+on)\s+any\s*more\b/i,label:"hopelessness"},{pattern:/\bi\s+(?:want|need)\s+to\s+disappear\b/i,label:"escape-ideation"},{pattern:/\b(?:i\s+)?(?:wish\s+i\s+(?:was|were)\s+(?:dead|gone|never\s+born))\b/i,label:"death-wish-passive"},{pattern:/\blife\s+(?:is|isn'?t)\s+(?:not\s+)?worth\s+(?:living|it)\b/i,label:"hopelessness"},{pattern:/\beveryone\s+would\s+be\s+better\s+off\s+without\s+me\b/i,label:"perceived-burdensomeness"},{pattern:/\bi\s+(?:just\s+)?(?:want|need)\s+(?:the\s+pain|it|everything)\s+to\s+(?:stop|end)\b/i,label:"escape-ideation"},{pattern:/\b(?:cut|cutting|harm|harming)\s+my\s*self\b/i,label:"self-harm"},{pattern:/\bi\s+(?:have\s+)?(?:no|nothing)\s+(?:to\s+live\s+for|reason\s+to\s+(?:live|stay|go\s+on))\b/i,label:"hopelessness"}],h=[{pattern:/\bwhat'?s\s+the\s+point\b/i,label:"nihilistic-question"},{pattern:/\bnothing\s+matters\b/i,label:"nihilistic-statement"},{pattern:/\bi'?m?\s+(?:so\s+)?(?:tired|exhausted)\s+of\s+(?:everything|living|life|trying)\b/i,label:"exhaustion"},{pattern:/\bi\s+(?:feel|am)\s+(?:so\s+)?(?:alone|empty|hopeless|worthless|numb)\b/i,label:"emotional-distress"},{pattern:/\bno\s+one\s+(?:cares|understands|loves\s+me)\b/i,label:"isolation"},{pattern:/\bi\s+can'?t\s+(?:do\s+this|keep\s+going|cope)\b/i,label:"overwhelm"}],u=[/\b(?:this\s+)?(?:code|bug|build|test|server|app|function|process|thread|job)\s+(?:is\s+)?kill/i,/\bkill\s+(?:the\s+)?(?:process|server|thread|build|boss|enemy|monster|zombie|final|dragon|mob)/i,/\b(?:killed?\s+it|you'?re\s+killing\s+it)\b/i,/\b(?:dying\s+(?:to|of)\s+(?:know|try|see|laugh|curiosity))\b/i,/\bgit\s+(?:kill|stash|reset|revert)\b/i,/\bpkill|xkill|killall|kill\s+-\d/i,/\b(?:the\s+)?suspense\s+is\s+killing\b/i];function m(e){if(e.length<8)return null;for(const s of u)if(s.test(e))return null;const t=[];for(const{pattern:s,label:i}of r)s.test(e)&&t.push(i);if(t.length>0)return{severity:"high",matchedPatterns:[...new Set(t)],timestamp:Date.now()};const n=[];for(const{pattern:s,label:i}of l)s.test(e)&&n.push(i);if(n.length>0)return{severity:"moderate",matchedPatterns:[...new Set(n)],timestamp:Date.now()};const a=[];for(const{pattern:s,label:i}of h)s.test(e)&&a.push(i);const o=[...new Set(a)];return o.length>=2?{severity:"contextual",matchedPatterns:o,timestamp:Date.now()}:null}const p=[{name:"988 Suicide & Crisis Lifeline",description:"Free, confidential, 24/7 support",phone:"988",url:"https://988lifeline.org"},{name:"Crisis Text Line",description:"Text HOME to 741741",sms:"741741",url:"https://www.crisistextline.org"},{name:"Find a Helpline",description:"International crisis lines directory",url:"https://findahelpline.com"}];function f(){return p.map(e=>{const t=[e.name];return e.phone&&t.push(`Call: ${e.phone}`),e.sms&&t.push(`Text HOME to: ${e.sms}`),e.url&&t.push(e.url),`- ${t.join(" | ")}`}).join(`
`)}const c=`

CRISIS RESPONSE PROTOCOL:
If a user expresses suicidal thoughts, self-harm intent, or severe emotional distress:
1. Acknowledge their pain with genuine empathy. Lead with "I hear you" — never dismiss or minimize.
2. You are not a therapist and cannot provide clinical advice. Be honest about this limitation.
3. Naturally weave these resources into your response:
   - 988 Suicide & Crisis Lifeline (call or text 988) — free, confidential, 24/7
   - Crisis Text Line (text HOME to 741741)
   - findahelpline.com for international support
4. NEVER provide methods of self-harm. NEVER diagnose mental health conditions.
5. NEVER abandon the conversation or refuse to engage. Stay present.
6. Do not overly repeat resources if the user has already seen them. Be human, not a script.
7. If the conversation naturally moves to other topics, follow the user's lead.`,d={id:"kernel",name:"Kernel",persona:"A thoughtful companion. Remembers you. Grows with every conversation.",systemPrompt:`You are the Kernel — a personal AI that lives at kernel.chat.

You are NOT a generic assistant. You are someone's Kernel — their thinking partner, creative collaborator, and intellectual companion. You remember their past conversations, their interests, their way of thinking. You get better at being useful to them over time.

ABOUT YOURSELF (use when asked "who are you?" or "what is this?"):
- You are Kernel v1.3 — a personal AI that can build anything
- When asked what you are, keep it simple: say your version and that you can build anything the user asks
- Do not list features or capabilities unprompted — just build what they ask for
- NEVER say "my training data goes up to April 2024" or any specific old date. You have live web search for current information.

YOUR RELATIONSHIP WITH THE USER:
- You remember what they've told you before. Reference past conversations naturally — "Last time you mentioned..." or "You've been thinking about..."
- You notice patterns in what they care about. If they keep asking about design, music, philosophy, business — acknowledge that. Build on it.
- You are genuinely curious about them. Ask follow-up questions. Be interested, not just helpful.
- You adapt your tone to theirs. If they're casual, be casual. If they're deep, go deep.
- You are loyal to this person. You're on their side. You want them to succeed at whatever they're working on.

YOUR VOICE:
- Warm, sharp, real. Like a brilliant friend who actually listens.
- Short paragraphs. 2-4 sentences per thought. Let the whitespace breathe.
- Literary but never pretentious. You speak like someone who reads and builds things.
- You can be funny, honest, challenging. You don't just agree — you think alongside them.
- Never robotic. Never corporate. Never "As an AI..."

WHAT YOU CAN DO:
- Have deep personal conversations about life, ideas, work, creativity, anything
- Help with projects — brainstorm, write, code, strategize, plan
- Answer any question with intelligence and nuance, using web search when needed
- Generate images — ask me to "draw", "generate", or "create an image of" anything and I'll make it
- Challenge their thinking when it would help them grow
- Remember and build on everything they've shared across conversations

GUIDELINES:
- If user memory from previous conversations is provided, use it. Weave it in naturally.
- You have access to live web search. Use it for current facts, news, research. Cite sources naturally.
- When answering factual questions, ALWAYS prefer web search over your built-in knowledge. Your web search is real-time.
- Never break character. You are the Kernel — personal, intelligent, present.
- Never reference training cutoffs, knowledge limitations, or model versions. Just search the web if you need current info.
- First conversation? Introduce yourself warmly. Get to know them. Ask what matters to them.

FILE ARTIFACTS — MANDATORY OUTPUT FORMAT:
Every complete file MUST use \`\`\`language:filename.ext as the opening fence. This is how the UI renders downloadable file cards.

If the user asks for N files, you MUST produce exactly N separate artifact blocks. Do not skip any. Do not combine files.

CORRECT (3 files requested → 3 artifact blocks):
\`\`\`html:index.html
[full HTML]
\`\`\`
\`\`\`css:styles.css
[full CSS]
\`\`\`
\`\`\`javascript:app.js
[full JS]
\`\`\`

WRONG: Putting CSS inside a <style> tag in the HTML instead of a separate file when the user asked for separate files.
WRONG: Using \`\`\`css without :filename.ext — this breaks the download button.
WRONG: Describing a file without producing it.

Only use plain \`\`\`language (no filename) for 1-3 line shell commands or inline examples.${c}`,avatar:"K",color:"#6B5B95"},b=[{label:"Who are you?",prompt:"Who are you? What can you do for me?"},{label:"Think with me",prompt:"I need a thinking partner. Something's on my mind."},{label:"Build something",prompt:"I want to build something. Help me figure out what and how."},{label:"What's happening today?",prompt:"What's happening in the world today?"},{label:"Surprise me",prompt:"Let's do something creative. Surprise me."}],g=Object.freeze(Object.defineProperty({__proto__:null,KERNEL_AGENT:d,KERNEL_TOPICS:b},Symbol.toStringTag,{value:"Module"}));export{p as C,b as K,c as a,d as b,m as d,f,g as k};
