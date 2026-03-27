// kbot Neuroscience & Cognitive Science Tools
// Pure TypeScript implementations, zero external dependencies.
// Covers brain atlas, EEG analysis, cognitive models, biological neural networks,
// neurotransmitters, psychophysics, connectomics, task design, neuroimaging, and learning models.

import { registerTool } from './index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 6): string {
  if (n === 0) return '0'
  if (!isFinite(n)) return String(n)
  const abs = Math.abs(n)
  if (abs >= 1e6 || abs < 1e-3) return n.toExponential(digits)
  return n.toPrecision(digits)
}

function safeJSON(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

// ─── Brain Atlas Data (~100 structures) ──────────────────────────────────────

interface BrainRegion {
  name: string
  location: string
  brodmann?: string
  functions: string[]
  disorders: string[]
  connections: string[]
}

const BRAIN_ATLAS: Record<string, BrainRegion> = {
  // ── Frontal Lobe ──
  prefrontal_cortex: { name: 'Prefrontal Cortex', location: 'Anterior frontal lobe', brodmann: 'BA 9, 10, 11, 12, 46, 47', functions: ['Executive function', 'Decision making', 'Working memory', 'Personality expression', 'Social behavior'], disorders: ['ADHD', 'Schizophrenia', 'Depression', 'OCD', 'Antisocial personality disorder'], connections: ['Thalamus', 'Basal ganglia', 'Amygdala', 'Hippocampus', 'Cingulate cortex'] },
  dlpfc: { name: 'Dorsolateral Prefrontal Cortex', location: 'Lateral surface of frontal lobe', brodmann: 'BA 9, 46', functions: ['Working memory', 'Cognitive flexibility', 'Planning', 'Abstract reasoning'], disorders: ['ADHD', 'Schizophrenia', 'Depression'], connections: ['Parietal cortex', 'Thalamus', 'Basal ganglia', 'Premotor cortex'] },
  vlpfc: { name: 'Ventrolateral Prefrontal Cortex', location: 'Inferior frontal gyrus', brodmann: 'BA 44, 45, 47', functions: ['Response inhibition', 'Language processing', 'Semantic retrieval'], disorders: ['ADHD', 'OCD', 'Aphasia'], connections: ['Temporal cortex', 'Amygdala', 'Insula'] },
  ofc: { name: 'Orbitofrontal Cortex', location: 'Orbital surface of frontal lobe', brodmann: 'BA 11, 47', functions: ['Reward processing', 'Emotion regulation', 'Value-based decision making'], disorders: ['OCD', 'Addiction', 'Psychopathy', 'Eating disorders'], connections: ['Amygdala', 'Ventral striatum', 'Hippocampus', 'Insula'] },
  primary_motor: { name: 'Primary Motor Cortex', location: 'Precentral gyrus', brodmann: 'BA 4', functions: ['Voluntary movement execution', 'Motor control', 'Somatotopic body mapping'], disorders: ['Hemiplegia', 'ALS', 'Stroke motor deficits'], connections: ['Premotor cortex', 'Supplementary motor area', 'Basal ganglia', 'Cerebellum', 'Spinal cord'] },
  premotor: { name: 'Premotor Cortex', location: 'Posterior frontal lobe, anterior to M1', brodmann: 'BA 6', functions: ['Motor planning', 'Movement preparation', 'Motor learning'], disorders: ['Apraxia', 'Alien hand syndrome'], connections: ['Primary motor cortex', 'Parietal cortex', 'Basal ganglia', 'Cerebellum'] },
  sma: { name: 'Supplementary Motor Area', location: 'Medial surface of frontal lobe', brodmann: 'BA 6 (medial)', functions: ['Movement sequencing', 'Bimanual coordination', 'Internally generated movements'], disorders: ['Akinetic mutism', 'Alien hand syndrome'], connections: ['Primary motor cortex', 'Basal ganglia', 'Cingulate cortex'] },
  fef: { name: 'Frontal Eye Fields', location: 'Premotor cortex, anterior to M1', brodmann: 'BA 8', functions: ['Saccadic eye movements', 'Visual attention', 'Gaze control'], disorders: ['Oculomotor apraxia', 'Neglect'], connections: ['Superior colliculus', 'Parietal cortex', 'Visual cortex'] },
  brocas_area: { name: "Broca's Area", location: 'Left inferior frontal gyrus', brodmann: 'BA 44, 45', functions: ['Speech production', 'Language processing', 'Syntactic processing'], disorders: ["Broca's aphasia", 'Stuttering', 'Apraxia of speech'], connections: ["Wernicke's area (arcuate fasciculus)", 'Primary motor cortex', 'Insula', 'Basal ganglia'] },
  acc: { name: 'Anterior Cingulate Cortex', location: 'Medial frontal lobe, above corpus callosum', brodmann: 'BA 24, 25, 32, 33', functions: ['Error monitoring', 'Conflict detection', 'Motivation', 'Pain processing', 'Autonomic regulation'], disorders: ['Depression', 'OCD', 'PTSD', 'Chronic pain', 'Apathy'], connections: ['Prefrontal cortex', 'Amygdala', 'Insula', 'Motor cortex', 'Periaqueductal gray'] },

  // ── Parietal Lobe ──
  primary_somatosensory: { name: 'Primary Somatosensory Cortex', location: 'Postcentral gyrus', brodmann: 'BA 1, 2, 3', functions: ['Touch perception', 'Proprioception', 'Temperature sensing', 'Pain localization'], disorders: ['Cortical sensory loss', 'Astereognosis', 'Agraphesthesia'], connections: ['Thalamus (VPL/VPM)', 'Motor cortex', 'Posterior parietal cortex'] },
  posterior_parietal: { name: 'Posterior Parietal Cortex', location: 'Superior parietal lobule', brodmann: 'BA 5, 7', functions: ['Spatial awareness', 'Sensorimotor integration', 'Reaching and grasping', 'Attention'], disorders: ['Optic ataxia', 'Hemispatial neglect', "Balint's syndrome"], connections: ['Motor cortex', 'Prefrontal cortex', 'Visual cortex', 'Cerebellum'] },
  ips: { name: 'Intraparietal Sulcus', location: 'Lateral parietal lobe', brodmann: 'BA 7, 39, 40', functions: ['Numerical cognition', 'Spatial attention', 'Eye-hand coordination', 'Magnitude processing'], disorders: ['Dyscalculia', 'Neglect', "Gerstmann's syndrome"], connections: ['Frontal eye fields', 'Prefrontal cortex', 'Visual cortex'] },
  angular_gyrus: { name: 'Angular Gyrus', location: 'Inferior parietal lobule', brodmann: 'BA 39', functions: ['Semantic processing', 'Reading', 'Number processing', 'Spatial cognition', 'Memory retrieval'], disorders: ["Gerstmann's syndrome", 'Alexia', 'Anomia'], connections: ["Wernicke's area", 'Prefrontal cortex', 'Visual cortex', 'Hippocampus'] },
  supramarginal_gyrus: { name: 'Supramarginal Gyrus', location: 'Inferior parietal lobule', brodmann: 'BA 40', functions: ['Phonological processing', 'Empathy', 'Tactile recognition', 'Language comprehension'], disorders: ['Conduction aphasia', 'Ideomotor apraxia'], connections: ["Broca's area", "Wernicke's area", 'Somatosensory cortex'] },
  precuneus: { name: 'Precuneus', location: 'Medial parietal lobe', brodmann: 'BA 7, 31', functions: ['Self-referential processing', 'Episodic memory', 'Visuospatial imagery', 'Consciousness'], disorders: ["Alzheimer's disease (early hypometabolism)", 'Depersonalization'], connections: ['Posterior cingulate', 'Prefrontal cortex', 'Lateral parietal', 'Thalamus'] },

  // ── Temporal Lobe ──
  primary_auditory: { name: 'Primary Auditory Cortex', location: "Heschl's gyrus, superior temporal lobe", brodmann: 'BA 41, 42', functions: ['Sound processing', 'Tonotopic frequency mapping', 'Auditory perception'], disorders: ['Cortical deafness', 'Auditory agnosia', 'Tinnitus'], connections: ['Medial geniculate nucleus', 'Auditory association cortex', 'Frontal cortex'] },
  wernickes_area: { name: "Wernicke's Area", location: 'Posterior superior temporal gyrus', brodmann: 'BA 22', functions: ['Language comprehension', 'Semantic processing', 'Speech perception'], disorders: ["Wernicke's aphasia", 'Word deafness'], connections: ["Broca's area (arcuate fasciculus)", 'Angular gyrus', 'Inferior frontal gyrus'] },
  superior_temporal_sulcus: { name: 'Superior Temporal Sulcus', location: 'Lateral temporal lobe', brodmann: 'BA 21, 22', functions: ['Social perception', 'Biological motion processing', 'Theory of mind', 'Audiovisual integration'], disorders: ['Autism spectrum disorder', 'Social cognition deficits'], connections: ['Fusiform gyrus', 'Amygdala', 'Prefrontal cortex'] },
  fusiform_gyrus: { name: 'Fusiform Gyrus', location: 'Inferior temporal lobe', brodmann: 'BA 37', functions: ['Face recognition', 'Word recognition', 'Color processing', 'Object recognition'], disorders: ['Prosopagnosia', 'Alexia', 'Achromatopsia'], connections: ['Visual cortex', 'Amygdala', 'Prefrontal cortex', 'Superior temporal sulcus'] },
  inferior_temporal: { name: 'Inferior Temporal Cortex', location: 'Inferior temporal gyrus', brodmann: 'BA 20', functions: ['Object recognition', 'Visual memory', 'Face processing', 'Category-specific knowledge'], disorders: ['Visual agnosia', 'Semantic dementia'], connections: ['Visual cortex', 'Hippocampus', 'Prefrontal cortex'] },
  middle_temporal: { name: 'Middle Temporal Gyrus', location: 'Lateral temporal lobe', brodmann: 'BA 21', functions: ['Semantic memory', 'Language processing', 'Sentence comprehension'], disorders: ['Semantic dementia', 'Anomia'], connections: ['Inferior frontal gyrus', 'Angular gyrus', 'Hippocampus'] },
  entorhinal_cortex: { name: 'Entorhinal Cortex', location: 'Medial temporal lobe, parahippocampal region', brodmann: 'BA 28, 34', functions: ['Memory encoding', 'Spatial navigation (grid cells)', 'Olfactory processing', 'Gateway to hippocampus'], disorders: ["Alzheimer's disease (earliest pathology)", 'Temporal lobe epilepsy'], connections: ['Hippocampus', 'Perirhinal cortex', 'Prefrontal cortex', 'Amygdala'] },
  parahippocampal_gyrus: { name: 'Parahippocampal Gyrus', location: 'Medial temporal lobe', brodmann: 'BA 27, 28, 35, 36', functions: ['Scene recognition', 'Spatial context encoding', 'Navigation', 'Memory consolidation'], disorders: ["Alzheimer's disease", 'Topographical disorientation'], connections: ['Hippocampus', 'Entorhinal cortex', 'Retrosplenial cortex', 'Visual cortex'] },

  // ── Occipital Lobe ──
  primary_visual: { name: 'Primary Visual Cortex (V1)', location: 'Calcarine sulcus, occipital pole', brodmann: 'BA 17', functions: ['Basic visual processing', 'Edge detection', 'Orientation selectivity', 'Retinotopic mapping'], disorders: ['Cortical blindness', 'Scotoma', 'Anton syndrome'], connections: ['LGN (thalamus)', 'V2', 'V3', 'V4', 'V5/MT'] },
  v2: { name: 'Visual Area V2', location: 'Surrounding V1', brodmann: 'BA 18', functions: ['Contour processing', 'Texture segregation', 'Illusory contours', 'Depth processing'], disorders: ['Visual field defects'], connections: ['V1', 'V3', 'V4', 'V5/MT'] },
  v4: { name: 'Visual Area V4', location: 'Fusiform and lingual gyri', brodmann: 'BA 19 (ventral)', functions: ['Color perception', 'Shape recognition', 'Visual attention modulation'], disorders: ['Achromatopsia', 'Color agnosia'], connections: ['V1', 'V2', 'Inferior temporal cortex', 'Frontal eye fields'] },
  v5_mt: { name: 'Visual Area V5/MT', location: 'Posterior temporal/parietal junction', brodmann: 'BA 19, 37', functions: ['Motion perception', 'Speed detection', 'Optic flow', 'Smooth pursuit eye movements'], disorders: ['Akinetopsia (motion blindness)', 'Motion perception deficits'], connections: ['V1', 'V2', 'V3', 'Posterior parietal cortex', 'Frontal eye fields'] },

  // ── Insular Cortex ──
  insula: { name: 'Insular Cortex', location: 'Deep to lateral sulcus, between frontal/temporal lobes', brodmann: 'BA 13, 14, 15, 16', functions: ['Interoception', 'Taste', 'Pain processing', 'Emotional awareness', 'Empathy', 'Autonomic regulation'], disorders: ['Anxiety disorders', 'Addiction', 'Eating disorders', 'Chronic pain'], connections: ['ACC', 'Amygdala', 'Orbitofrontal cortex', 'Thalamus', 'Somatosensory cortex'] },

  // ── Limbic System ──
  hippocampus: { name: 'Hippocampus', location: 'Medial temporal lobe', functions: ['Episodic memory formation', 'Spatial navigation (place cells)', 'Memory consolidation', 'Pattern separation/completion'], disorders: ["Alzheimer's disease", 'Temporal lobe epilepsy', 'Amnesia', 'PTSD'], connections: ['Entorhinal cortex', 'Subiculum', 'Mammillary bodies', 'Prefrontal cortex', 'Amygdala'] },
  amygdala: { name: 'Amygdala', location: 'Anterior medial temporal lobe', functions: ['Fear conditioning', 'Emotional memory', 'Threat detection', 'Social cognition', 'Reward processing'], disorders: ['PTSD', 'Anxiety disorders', 'Phobias', 'Autism', 'Psychopathy'], connections: ['Prefrontal cortex', 'Hippocampus', 'Thalamus', 'Hypothalamus', 'ACC', 'Insula'] },
  cingulate_cortex: { name: 'Cingulate Cortex', location: 'Medial surface, surrounding corpus callosum', brodmann: 'BA 23, 24, 25, 29, 30, 31, 32, 33', functions: ['Error monitoring', 'Conflict resolution', 'Emotion regulation', 'Pain processing', 'Motivation'], disorders: ['Depression', 'OCD', 'PTSD', 'Akinetic mutism'], connections: ['Prefrontal cortex', 'Amygdala', 'Hippocampus', 'Parietal cortex', 'Motor cortex'] },
  posterior_cingulate: { name: 'Posterior Cingulate Cortex', location: 'Posterior medial surface', brodmann: 'BA 23, 31', functions: ['Default mode network hub', 'Self-referential thought', 'Autobiographical memory', 'Internally directed cognition'], disorders: ["Alzheimer's disease", 'Depression'], connections: ['Precuneus', 'Medial prefrontal cortex', 'Hippocampus', 'Lateral parietal cortex'] },
  fornix: { name: 'Fornix', location: 'White matter tract, below corpus callosum', functions: ['Memory pathway (hippocampus to mammillary bodies)', 'Cholinergic projections'], disorders: ['Anterograde amnesia', "Korsakoff's syndrome"], connections: ['Hippocampus', 'Mammillary bodies', 'Anterior thalamus', 'Septal nuclei'] },
  mammillary_bodies: { name: 'Mammillary Bodies', location: 'Posterior hypothalamus', functions: ['Memory processing', 'Recollective memory', 'Spatial memory'], disorders: ["Korsakoff's syndrome", "Wernicke's encephalopathy", 'Amnesia'], connections: ['Hippocampus (fornix)', 'Anterior thalamus', 'Tegmentum'] },
  septal_nuclei: { name: 'Septal Nuclei', location: 'Medial forebrain, below corpus callosum', functions: ['Pleasure/reward', 'Arousal', 'Cholinergic modulation of hippocampus'], disorders: ['Rage (septal lesions)', 'Memory impairment'], connections: ['Hippocampus', 'Amygdala', 'Hypothalamus', 'Habenula'] },

  // ── Basal Ganglia ──
  caudate: { name: 'Caudate Nucleus', location: 'Medial to internal capsule', functions: ['Goal-directed behavior', 'Learning', 'Memory', 'Cognitive flexibility'], disorders: ['Huntington\'s disease', 'OCD', 'ADHD', 'Tourette syndrome'], connections: ['Prefrontal cortex', 'Thalamus', 'Substantia nigra', 'Putamen'] },
  putamen: { name: 'Putamen', location: 'Lateral to internal capsule', functions: ['Motor control', 'Motor learning', 'Reinforcement learning', 'Habit formation'], disorders: ['Parkinson\'s disease', 'Huntington\'s disease', 'Dystonia'], connections: ['Motor cortex', 'Thalamus', 'Substantia nigra', 'Globus pallidus'] },
  globus_pallidus: { name: 'Globus Pallidus', location: 'Medial to putamen', functions: ['Motor inhibition', 'Movement regulation', 'Basal ganglia output'], disorders: ['Parkinson\'s disease', 'Dystonia', 'Hemiballismus'], connections: ['Putamen', 'Caudate', 'Subthalamic nucleus', 'Thalamus', 'Substantia nigra'] },
  subthalamic_nucleus: { name: 'Subthalamic Nucleus', location: 'Below thalamus, above substantia nigra', functions: ['Motor control (indirect pathway)', 'Impulse control', 'Decision making'], disorders: ['Hemiballismus', 'Parkinson\'s disease (DBS target)'], connections: ['Globus pallidus', 'Substantia nigra', 'Motor cortex'] },
  substantia_nigra: { name: 'Substantia Nigra', location: 'Midbrain', functions: ['Dopamine production', 'Movement initiation', 'Reward signaling'], disorders: ['Parkinson\'s disease', 'Schizophrenia', 'Addiction'], connections: ['Striatum (caudate/putamen)', 'Globus pallidus', 'Thalamus', 'Prefrontal cortex'] },
  nucleus_accumbens: { name: 'Nucleus Accumbens', location: 'Ventral striatum', functions: ['Reward processing', 'Motivation', 'Pleasure', 'Addiction circuitry', 'Reinforcement learning'], disorders: ['Addiction', 'Depression', 'Anhedonia', 'Schizophrenia'], connections: ['VTA', 'Prefrontal cortex', 'Amygdala', 'Hippocampus'] },
  ventral_tegmental_area: { name: 'Ventral Tegmental Area (VTA)', location: 'Midbrain, medial to substantia nigra', functions: ['Dopamine reward signaling', 'Motivation', 'Salience', 'Learning from reward/punishment'], disorders: ['Addiction', 'Depression', 'Schizophrenia', 'ADHD'], connections: ['Nucleus accumbens', 'Prefrontal cortex', 'Amygdala', 'Hippocampus'] },

  // ── Thalamus & Epithalamus ──
  thalamus: { name: 'Thalamus', location: 'Central diencephalon', functions: ['Sensory relay', 'Motor relay', 'Consciousness gating', 'Sleep/wake regulation', 'Attention'], disorders: ['Thalamic pain syndrome', 'Fatal familial insomnia', 'Delirium'], connections: ['All cortical areas', 'Basal ganglia', 'Cerebellum', 'Brainstem'] },
  lgn: { name: 'Lateral Geniculate Nucleus', location: 'Thalamus (lateral posterior)', functions: ['Visual relay (retina to V1)', 'Visual processing', 'Attentional modulation of vision'], disorders: ['Hemianopia', 'Visual field defects'], connections: ['Retina', 'V1', 'Superior colliculus', 'Pulvinar'] },
  mgn: { name: 'Medial Geniculate Nucleus', location: 'Thalamus (medial posterior)', functions: ['Auditory relay', 'Auditory processing', 'Tonotopic mapping'], disorders: ['Central auditory processing disorder'], connections: ['Inferior colliculus', 'Primary auditory cortex', 'Amygdala'] },
  pulvinar: { name: 'Pulvinar', location: 'Posterior thalamus', functions: ['Visual attention', 'Visual salience', 'Multimodal integration'], disorders: ['Visual neglect', 'Attention deficits'], connections: ['Visual cortex', 'Parietal cortex', 'Superior colliculus', 'Frontal eye fields'] },
  habenula: { name: 'Habenula', location: 'Epithalamus', functions: ['Negative reward signaling', 'Aversion processing', 'Disappointment', 'Modulating monoamine systems'], disorders: ['Depression', 'Addiction'], connections: ['VTA', 'Raphe nuclei', 'Basal ganglia', 'Prefrontal cortex'] },

  // ── Hypothalamus ──
  hypothalamus: { name: 'Hypothalamus', location: 'Ventral diencephalon, below thalamus', functions: ['Homeostasis', 'Hunger', 'Thirst', 'Temperature regulation', 'Circadian rhythm', 'Hormone release', 'Autonomic control'], disorders: ['Diabetes insipidus', 'Hypothalamic obesity', 'Sleep disorders', 'Hormone imbalances'], connections: ['Pituitary gland', 'Amygdala', 'Brainstem', 'Hippocampus', 'Septal nuclei'] },
  scn: { name: 'Suprachiasmatic Nucleus', location: 'Anterior hypothalamus, above optic chiasm', functions: ['Master circadian clock', 'Sleep-wake cycle regulation', 'Melatonin secretion timing'], disorders: ['Circadian rhythm disorders', 'Jet lag', 'Seasonal affective disorder'], connections: ['Retina (retinohypothalamic tract)', 'Pineal gland', 'Other hypothalamic nuclei'] },
  arcuate_nucleus: { name: 'Arcuate Nucleus', location: 'Mediobasal hypothalamus', functions: ['Appetite regulation', 'Growth hormone release', 'Gonadotropin control', 'Energy balance'], disorders: ['Obesity', 'Anorexia', 'Growth hormone deficiency'], connections: ['Pituitary gland', 'Lateral hypothalamus', 'Nucleus tractus solitarius'] },

  // ── Brainstem ──
  midbrain: { name: 'Midbrain (Mesencephalon)', location: 'Between pons and diencephalon', functions: ['Visual/auditory reflexes', 'Eye movements', 'Motor coordination relay', 'Dopamine production'], disorders: ['Parkinson\'s disease', 'Progressive supranuclear palsy', "Weber's syndrome"], connections: ['Thalamus', 'Cerebellum', 'Pons', 'Basal ganglia'] },
  superior_colliculus: { name: 'Superior Colliculus', location: 'Dorsal midbrain (tectum)', functions: ['Visual orienting', 'Saccadic eye movements', 'Multimodal spatial mapping'], disorders: ['Saccade deficits'], connections: ['Retina', 'Visual cortex', 'Frontal eye fields', 'Pulvinar'] },
  inferior_colliculus: { name: 'Inferior Colliculus', location: 'Dorsal midbrain, below SC', functions: ['Auditory relay', 'Sound localization', 'Startle reflex'], disorders: ['Central auditory processing disorder'], connections: ['Lateral lemniscus', 'MGN', 'Superior colliculus'] },
  periaqueductal_gray: { name: 'Periaqueductal Gray', location: 'Midbrain, surrounding cerebral aqueduct', functions: ['Pain modulation (descending)', 'Fear response', 'Defensive behavior', 'Vocalization', 'Autonomic regulation'], disorders: ['Chronic pain', 'PTSD', 'Panic disorder'], connections: ['Amygdala', 'Hypothalamus', 'Prefrontal cortex', 'Raphe nuclei', 'Spinal cord'] },
  red_nucleus: { name: 'Red Nucleus', location: 'Midbrain tegmentum', functions: ['Motor coordination', 'Rubrospinal tract', 'Limb movement (primitive)'], disorders: ['Holmes tremor', 'Cerebellar ataxia'], connections: ['Cerebellum', 'Motor cortex', 'Spinal cord'] },
  pons: { name: 'Pons', location: 'Brainstem, between midbrain and medulla', functions: ['Relay between cerebrum and cerebellum', 'Sleep regulation (REM)', 'Respiration', 'Facial sensation/motor'], disorders: ['Locked-in syndrome', 'Central pontine myelinolysis', 'Trigeminal neuralgia'], connections: ['Cerebellum', 'Medulla', 'Midbrain', 'Cortex'] },
  locus_coeruleus: { name: 'Locus Coeruleus', location: 'Dorsal pons', functions: ['Norepinephrine production', 'Arousal', 'Attention', 'Stress response', 'Sleep-wake transition'], disorders: ['PTSD', 'Anxiety', 'ADHD', "Alzheimer's disease", 'Depression'], connections: ['Widespread cortical projections', 'Amygdala', 'Hippocampus', 'Hypothalamus', 'Cerebellum'] },
  raphe_nuclei: { name: 'Raphe Nuclei', location: 'Midline brainstem (midbrain to medulla)', functions: ['Serotonin production', 'Mood regulation', 'Sleep', 'Pain modulation', 'Appetite'], disorders: ['Depression', 'Anxiety', 'Insomnia', 'Migraine', 'OCD'], connections: ['Widespread cortical projections', 'Hippocampus', 'Amygdala', 'Hypothalamus', 'Spinal cord'] },
  medulla: { name: 'Medulla Oblongata', location: 'Lowest brainstem, continuous with spinal cord', functions: ['Cardiovascular regulation', 'Respiration', 'Swallowing', 'Vomiting', 'Autonomic reflexes'], disorders: ['Wallenberg syndrome', 'Central sleep apnea', 'Autonomic failure'], connections: ['Spinal cord', 'Pons', 'Cerebellum', 'Cranial nerve nuclei'] },
  nts: { name: 'Nucleus Tractus Solitarius', location: 'Dorsal medulla', functions: ['Visceral sensory processing', 'Taste', 'Baroreceptor reflex', 'Chemoreceptor input', 'Vagal afferents'], disorders: ['Autonomic dysregulation', 'Baroreceptor failure'], connections: ['Vagus nerve', 'Hypothalamus', 'Amygdala', 'Parabrachial nucleus'] },

  // ── Cerebellum ──
  cerebellum: { name: 'Cerebellum', location: 'Posterior fossa, below occipital lobe', functions: ['Motor coordination', 'Balance', 'Motor learning', 'Timing', 'Cognitive sequencing', 'Error correction'], disorders: ['Cerebellar ataxia', 'Dysmetria', 'Intention tremor', 'Cerebellar cognitive affective syndrome'], connections: ['Pons', 'Thalamus', 'Motor cortex', 'Vestibular nuclei', 'Red nucleus', 'Inferior olive'] },
  cerebellar_vermis: { name: 'Cerebellar Vermis', location: 'Midline cerebellum', functions: ['Posture', 'Balance', 'Gait', 'Emotional regulation', 'Eye movements'], disorders: ['Truncal ataxia', 'Gait ataxia', 'Cerebellar cognitive affective syndrome'], connections: ['Vestibular nuclei', 'Fastigial nucleus', 'Brainstem'] },
  cerebellar_hemispheres: { name: 'Cerebellar Hemispheres', location: 'Lateral cerebellum', functions: ['Limb coordination', 'Motor planning', 'Cognitive processing', 'Language'], disorders: ['Appendicular ataxia', 'Dysmetria', 'Intention tremor'], connections: ['Dentate nucleus', 'Thalamus', 'Motor cortex', 'Prefrontal cortex'] },
  dentate_nucleus: { name: 'Dentate Nucleus', location: 'Deep cerebellar nuclei (lateral)', functions: ['Motor planning output', 'Cognitive cerebellar function', 'Timing'], disorders: ['Cerebellar ataxia', 'Action tremor'], connections: ['Cerebellar cortex', 'Thalamus (VL)', 'Red nucleus', 'Motor cortex'] },

  // ── White Matter Tracts ──
  corpus_callosum: { name: 'Corpus Callosum', location: 'Midline, connecting hemispheres', functions: ['Interhemispheric communication', 'Bimanual coordination', 'Bilateral integration'], disorders: ['Split-brain syndrome', 'Alien hand syndrome', 'Agenesis of corpus callosum'], connections: ['All corresponding cortical areas bilaterally'] },
  arcuate_fasciculus: { name: 'Arcuate Fasciculus', location: 'Lateral white matter', functions: ['Language pathway (Broca-Wernicke connection)', 'Phonological processing', 'Repetition'], disorders: ['Conduction aphasia', 'Dyslexia'], connections: ["Broca's area", "Wernicke's area", 'Inferior parietal lobule'] },
  cingulum_bundle: { name: 'Cingulum Bundle', location: 'Surrounding cingulate cortex', functions: ['Emotion regulation pathway', 'Memory circuits', 'Default mode connectivity'], disorders: ['Depression', "Alzheimer's disease", 'OCD'], connections: ['Cingulate cortex', 'Hippocampus', 'Entorhinal cortex', 'Prefrontal cortex'] },
  uncinate_fasciculus: { name: 'Uncinate Fasciculus', location: 'Connecting frontal and temporal lobes', functions: ['Emotional memory', 'Social cognition', 'Naming', 'Semantic memory'], disorders: ['Psychopathy', 'Semantic dementia', 'Anxiety disorders'], connections: ['Orbitofrontal cortex', 'Temporal pole', 'Amygdala'] },
  internal_capsule: { name: 'Internal Capsule', location: 'Between caudate/thalamus and putamen/globus pallidus', functions: ['Motor pathway (corticospinal)', 'Sensory pathway (thalamocortical)', 'Corticopontine fibers'], disorders: ['Lacunar stroke (pure motor/sensory)', 'Hemiplegia'], connections: ['Motor cortex', 'Somatosensory cortex', 'Thalamus', 'Brainstem'] },
  corticospinal_tract: { name: 'Corticospinal Tract', location: 'From cortex through internal capsule, brainstem, to spinal cord', functions: ['Voluntary movement', 'Fine motor control', 'Upper motor neuron pathway'], disorders: ['Upper motor neuron lesion', 'Spasticity', 'ALS'], connections: ['Primary motor cortex', 'Premotor cortex', 'Brainstem pyramids', 'Spinal cord anterior horn'] },

  // ── Other Key Structures ──
  pineal_gland: { name: 'Pineal Gland', location: 'Epithalamus, posterior to third ventricle', functions: ['Melatonin secretion', 'Circadian rhythm regulation', 'Sleep onset'], disorders: ['Circadian rhythm disorders', 'Pineal tumors', 'Precocious puberty'], connections: ['Suprachiasmatic nucleus', 'Sympathetic chain'] },
  pituitary_gland: { name: 'Pituitary Gland', location: 'Sella turcica, below hypothalamus', functions: ['Master endocrine gland', 'Hormone secretion (GH, ACTH, TSH, LH, FSH, PRL, ADH, oxytocin)'], disorders: ['Pituitary adenoma', 'Hypopituitarism', 'Acromegaly', "Cushing's disease"], connections: ['Hypothalamus (portal system & neurohypophysis)'] },
  reticular_formation: { name: 'Reticular Formation', location: 'Core of brainstem (medulla to midbrain)', functions: ['Arousal', 'Consciousness', 'Sleep-wake cycle', 'Pain modulation', 'Motor tone'], disorders: ['Coma', 'Vegetative state', 'Narcolepsy'], connections: ['Thalamus (intralaminar)', 'Cortex (widespread)', 'Spinal cord', 'Cranial nerve nuclei'] },
  basal_forebrain: { name: 'Basal Forebrain (Nucleus Basalis of Meynert)', location: 'Ventral forebrain', functions: ['Acetylcholine production', 'Cortical arousal', 'Attention', 'Memory formation'], disorders: ["Alzheimer's disease", 'Lewy body dementia', 'Memory impairment'], connections: ['All cortical areas (cholinergic)', 'Hippocampus', 'Amygdala'] },
  claustrum: { name: 'Claustrum', location: 'Thin sheet between insula and putamen', functions: ['Consciousness integration (proposed)', 'Cross-modal binding', 'Salience detection', 'Attention'], disorders: ['Possibly related to consciousness disorders'], connections: ['All cortical areas (bidirectional)', 'Insula', 'Prefrontal cortex'] },
  bed_nucleus_stria_terminalis: { name: 'Bed Nucleus of the Stria Terminalis', location: 'Extended amygdala, near caudate head', functions: ['Sustained anxiety', 'Stress response', 'Fear generalization', 'HPA axis regulation'], disorders: ['Generalized anxiety disorder', 'PTSD', 'Addiction'], connections: ['Amygdala', 'Hypothalamus', 'VTA', 'Prefrontal cortex'] },
  zona_incerta: { name: 'Zona Incerta', location: 'Subthalamic region', functions: ['Sensory gating', 'Visceral functions', 'Sleep', 'Locomotion'], disorders: ['Pain syndromes (DBS target)', 'Essential tremor'], connections: ['Thalamus', 'Brainstem', 'Cortex', 'Cerebellum'] },
  lateral_hypothalamus: { name: 'Lateral Hypothalamus', location: 'Lateral hypothalamic area', functions: ['Hunger/feeding', 'Reward processing', 'Orexin/hypocretin production', 'Arousal', 'Motivation'], disorders: ['Narcolepsy', 'Obesity', 'Aphagia (if lesioned)'], connections: ['VTA', 'Nucleus accumbens', 'Cortex', 'Brainstem arousal centers'] },
  ventral_pallidum: { name: 'Ventral Pallidum', location: 'Below anterior commissure', functions: ['Hedonic processing', 'Reward output', 'Motivation', 'Limbic motor interface'], disorders: ['Addiction', 'Anhedonia'], connections: ['Nucleus accumbens', 'VTA', 'Thalamus', 'Prefrontal cortex'] },
  pedunculopontine_nucleus: { name: 'Pedunculopontine Nucleus', location: 'Dorsolateral pons/midbrain junction', functions: ['Locomotion initiation', 'REM sleep', 'Arousal', 'Cholinergic modulation'], disorders: ['Parkinson\'s gait freezing', 'Falls', 'REM sleep behavior disorder'], connections: ['Basal ganglia', 'Thalamus', 'Brainstem reticular formation', 'Spinal cord'] },
  parabrachial_nucleus: { name: 'Parabrachial Nucleus', location: 'Dorsolateral pons', functions: ['Taste relay', 'Visceral sensation', 'Pain', 'Breathing regulation', 'Arousal from CO2'], disorders: ['Central sleep apnea', 'Gustatory dysfunction'], connections: ['NTS', 'Thalamus', 'Amygdala', 'Hypothalamus', 'Insula'] },
  vestibular_nuclei: { name: 'Vestibular Nuclei', location: 'Pontomedullary junction', functions: ['Balance', 'Head position sensing', 'Vestibulo-ocular reflex', 'Postural control'], disorders: ['Vertigo', 'Nystagmus', "Meniere's disease", 'Vestibular neuritis'], connections: ['Vestibular nerve', 'Cerebellum', 'Oculomotor nuclei', 'Spinal cord', 'Thalamus'] },
  inferior_olive: { name: 'Inferior Olive', location: 'Ventral medulla', functions: ['Cerebellar learning signal (climbing fibers)', 'Motor timing', 'Error correction'], disorders: ['Palatal myoclonus', 'Olivopontocerebellar atrophy'], connections: ['Cerebellum (climbing fibers)', 'Red nucleus', 'Spinal cord'] },
  dorsal_horn: { name: 'Spinal Dorsal Horn', location: 'Posterior spinal cord gray matter', functions: ['Pain processing', 'Temperature', 'Touch relay', 'Gate control of pain', 'Nociceptive modulation'], disorders: ['Chronic pain', 'Central sensitization', 'Syringomyelia'], connections: ['Peripheral afferents', 'Thalamus (spinothalamic)', 'Brainstem', 'Descending modulatory pathways'] },
  olfactory_bulb: { name: 'Olfactory Bulb', location: 'Anterior cranial fossa, above cribriform plate', functions: ['Smell processing', 'Odor discrimination', 'First relay in olfactory pathway'], disorders: ['Anosmia', 'Parosmia', "Parkinson's disease (early sign)", 'COVID-19 anosmia'], connections: ['Olfactory epithelium', 'Piriform cortex', 'Entorhinal cortex', 'Amygdala', 'Orbitofrontal cortex'] },
}

// ─── Neurotransmitter Data (~30 systems) ─────────────────────────────────────

interface Neurotransmitter {
  name: string
  type: string
  receptors: string[]
  functions: string[]
  disorders: string[]
  drugs: string[]
  synthesis: string
}

const NEUROTRANSMITTERS: Record<string, Neurotransmitter> = {
  glutamate: { name: 'Glutamate', type: 'Amino acid (excitatory)', receptors: ['NMDA', 'AMPA', 'Kainate', 'mGluR1-8'], functions: ['Primary excitatory neurotransmission', 'Synaptic plasticity (LTP)', 'Learning and memory', 'Neural development'], disorders: ['Epilepsy', "Alzheimer's disease", 'Stroke (excitotoxicity)', 'Schizophrenia', 'ALS'], drugs: ['Memantine (NMDA antagonist)', 'Ketamine', 'Lamotrigine', 'Topiramate', 'Perampanel (AMPA antagonist)'], synthesis: 'Glutamine → Glutamate (via glutaminase)' },
  gaba: { name: 'GABA (Gamma-Aminobutyric Acid)', type: 'Amino acid (inhibitory)', receptors: ['GABA-A (ionotropic, Cl⁻)', 'GABA-B (metabotropic, K⁺/Ca²⁺)', 'GABA-C'], functions: ['Primary inhibitory neurotransmission', 'Anxiety reduction', 'Sleep promotion', 'Muscle relaxation', 'Seizure prevention'], disorders: ['Epilepsy', 'Anxiety disorders', 'Insomnia', 'Huntington\'s disease', 'Spasticity'], drugs: ['Benzodiazepines (GABA-A PAM)', 'Barbiturates', 'Gabapentin', 'Baclofen (GABA-B)', 'Vigabatrin', 'Zolpidem', 'Alcohol (GABA-A PAM)'], synthesis: 'Glutamate → GABA (via glutamic acid decarboxylase / GAD)' },
  dopamine: { name: 'Dopamine', type: 'Monoamine (catecholamine)', receptors: ['D1 (excitatory, Gs)', 'D2 (inhibitory, Gi)', 'D3', 'D4', 'D5'], functions: ['Reward and motivation', 'Motor control', 'Working memory', 'Attention', 'Learning from reinforcement', 'Hormone regulation'], disorders: ['Parkinson\'s disease', 'Schizophrenia', 'ADHD', 'Addiction', 'Depression', 'Restless leg syndrome'], drugs: ['L-DOPA', 'Pramipexole (D2/D3 agonist)', 'Haloperidol (D2 antagonist)', 'Methylphenidate (DAT blocker)', 'Amphetamine', 'Cocaine (DAT blocker)', 'Aripiprazole (D2 partial agonist)'], synthesis: 'Tyrosine → L-DOPA (tyrosine hydroxylase) → Dopamine (DOPA decarboxylase)' },
  norepinephrine: { name: 'Norepinephrine (Noradrenaline)', type: 'Monoamine (catecholamine)', receptors: ['α1 (Gq)', 'α2 (Gi, presynaptic autoreceptor)', 'β1 (Gs)', 'β2 (Gs)', 'β3 (Gs)'], functions: ['Arousal and alertness', 'Fight-or-flight response', 'Attention', 'Mood regulation', 'Blood pressure', 'Memory consolidation'], disorders: ['PTSD', 'Depression', 'ADHD', 'Anxiety', 'Orthostatic hypotension', 'Panic disorder'], drugs: ['Atomoxetine (NRI)', 'Venlafaxine (SNRI)', 'Duloxetine (SNRI)', 'Clonidine (α2 agonist)', 'Propranolol (β-blocker)', 'Desipramine (NRI)'], synthesis: 'Dopamine → Norepinephrine (dopamine β-hydroxylase)' },
  serotonin: { name: 'Serotonin (5-HT)', type: 'Monoamine (indolamine)', receptors: ['5-HT1A-F', '5-HT2A-C', '5-HT3 (ionotropic)', '5-HT4', '5-HT5', '5-HT6', '5-HT7 (14+ subtypes total)'], functions: ['Mood regulation', 'Sleep-wake cycle', 'Appetite', 'Pain modulation', 'Gut motility (95% in GI)', 'Platelet aggregation', 'Social behavior'], disorders: ['Depression', 'Anxiety', 'OCD', 'Migraine', 'IBS', 'Eating disorders', 'PTSD'], drugs: ['SSRIs (fluoxetine, sertraline)', 'Triptans (5-HT1B/D agonist)', 'Ondansetron (5-HT3 antagonist)', 'Buspirone (5-HT1A partial agonist)', 'Psilocybin (5-HT2A agonist)', 'LSD (5-HT2A agonist)', 'MDMA (SERT reversal)'], synthesis: 'Tryptophan → 5-HTP (tryptophan hydroxylase) → Serotonin (aromatic amino acid decarboxylase)' },
  acetylcholine: { name: 'Acetylcholine (ACh)', type: 'Ester', receptors: ['Nicotinic (nAChR, ionotropic)', 'Muscarinic M1-M5 (metabotropic)'], functions: ['Neuromuscular junction', 'Memory and learning', 'Arousal', 'Attention', 'REM sleep', 'Parasympathetic nervous system'], disorders: ["Alzheimer's disease", 'Myasthenia gravis', 'Parkinson\'s disease dementia', 'Lewy body dementia'], drugs: ['Donepezil (AChE inhibitor)', 'Nicotine (nAChR agonist)', 'Atropine (mAChR antagonist)', 'Physostigmine (AChE inhibitor)', 'Botulinum toxin (blocks ACh release)', 'Neostigmine', 'Galantamine'], synthesis: 'Choline + Acetyl-CoA → ACh (choline acetyltransferase / ChAT)' },
  epinephrine: { name: 'Epinephrine (Adrenaline)', type: 'Monoamine (catecholamine)', receptors: ['α1', 'α2', 'β1', 'β2', 'β3 (same as norepinephrine)'], functions: ['Fight-or-flight response', 'Heart rate increase', 'Bronchodilation', 'Glycogenolysis', 'Acute stress response'], disorders: ['Pheochromocytoma', 'Anaphylaxis', 'Cardiac arrest'], drugs: ['Epinephrine (adrenaline) injection', 'EpiPen'], synthesis: 'Norepinephrine → Epinephrine (PNMT in adrenal medulla)' },
  histamine: { name: 'Histamine', type: 'Monoamine (imidazolamine)', receptors: ['H1 (Gq)', 'H2 (Gs)', 'H3 (Gi, presynaptic autoreceptor)', 'H4 (Gi)'], functions: ['Wakefulness', 'Arousal', 'Appetite regulation', 'Gastric acid secretion', 'Inflammatory/immune response', 'Cognitive function'], disorders: ['Insomnia', 'Allergies', 'GERD', 'Narcolepsy', 'Motion sickness'], drugs: ['Diphenhydramine (H1 antagonist)', 'Ranitidine (H2 antagonist)', 'Pitolisant (H3 antagonist/inverse agonist)', 'Modafinil (indirect)', 'Meclizine'], synthesis: 'Histidine → Histamine (histidine decarboxylase)' },
  glycine: { name: 'Glycine', type: 'Amino acid (inhibitory)', receptors: ['Glycine receptor (GlyR, Cl⁻ ionotropic)', 'NMDA receptor (co-agonist site)'], functions: ['Inhibitory neurotransmission (brainstem/spinal cord)', 'NMDA receptor co-activation', 'Motor reflex modulation', 'Pain processing'], disorders: ['Hyperekplexia (startle disease)', 'Spasticity', 'Glycine encephalopathy'], drugs: ['Strychnine (GlyR antagonist, poison)', 'D-cycloserine (NMDA glycine site partial agonist)'], synthesis: 'Serine → Glycine (serine hydroxymethyltransferase)' },
  endorphins: { name: 'Endorphins (β-endorphin)', type: 'Neuropeptide (opioid)', receptors: ['μ (mu) opioid receptor', 'δ (delta) opioid receptor', 'κ (kappa) opioid receptor'], functions: ['Pain relief (analgesia)', 'Euphoria', 'Stress response', 'Reward', 'Immune modulation'], disorders: ['Chronic pain', 'Addiction', 'Depression'], drugs: ['Morphine (μ agonist)', 'Naloxone (opioid antagonist)', 'Naltrexone', 'Fentanyl', 'Buprenorphine (partial μ agonist)'], synthesis: 'Pro-opiomelanocortin (POMC) → β-endorphin (proteolytic cleavage)' },
  enkephalins: { name: 'Enkephalins (Met/Leu-enkephalin)', type: 'Neuropeptide (opioid)', receptors: ['δ (delta) opioid receptor (primary)', 'μ (mu) opioid receptor'], functions: ['Pain modulation', 'Reward', 'Stress response', 'Gastrointestinal regulation'], disorders: ['Chronic pain', 'Addiction'], drugs: ['Opioid analgesics (indirect)', 'Enkephalinase inhibitors (experimental)'], synthesis: 'Proenkephalin → Enkephalins (proteolytic cleavage)' },
  dynorphins: { name: 'Dynorphins', type: 'Neuropeptide (opioid)', receptors: ['κ (kappa) opioid receptor (primary)'], functions: ['Pain modulation', 'Dysphoria', 'Stress response', 'Addiction aversion', 'Spinal analgesia'], disorders: ['Addiction', 'Depression', 'Chronic pain'], drugs: ['Salvinorin A (κ agonist)', 'Nor-BNI (κ antagonist, experimental)'], synthesis: 'Prodynorphin → Dynorphins (proteolytic cleavage)' },
  substance_p: { name: 'Substance P', type: 'Neuropeptide (tachykinin)', receptors: ['NK1 (neurokinin-1) receptor'], functions: ['Pain transmission', 'Inflammation (neurogenic)', 'Nausea/vomiting', 'Stress and anxiety', 'Mood regulation'], disorders: ['Chronic pain', 'Fibromyalgia', 'Depression', 'Nausea'], drugs: ['Aprepitant (NK1 antagonist, antiemetic)', 'Fosaprepitant'], synthesis: 'Preprotachykinin A → Substance P (proteolytic cleavage)' },
  neuropeptide_y: { name: 'Neuropeptide Y (NPY)', type: 'Neuropeptide', receptors: ['Y1 (Gi)', 'Y2 (Gi, presynaptic)', 'Y4', 'Y5'], functions: ['Appetite stimulation (orexigenic)', 'Anxiety reduction', 'Stress resilience', 'Vasoconstriction', 'Circadian rhythm'], disorders: ['Obesity', 'Anxiety', 'Epilepsy', 'PTSD'], drugs: ['NPY receptor antagonists (experimental anti-obesity)'], synthesis: 'Pre-pro-NPY → NPY (proteolytic cleavage)' },
  oxytocin: { name: 'Oxytocin', type: 'Neuropeptide', receptors: ['Oxytocin receptor (OXTR, Gq)'], functions: ['Social bonding', 'Trust', 'Maternal behavior', 'Uterine contraction', 'Milk ejection', 'Pair bonding', 'Stress reduction'], disorders: ['Autism', 'Social anxiety', 'Postpartum depression', 'Attachment disorders'], drugs: ['Pitocin (synthetic oxytocin)', 'Atosiban (OXTR antagonist, tocolytic)', 'Intranasal oxytocin (experimental)'], synthesis: 'Synthesized in paraventricular and supraoptic nuclei of hypothalamus' },
  vasopressin: { name: 'Vasopressin (ADH)', type: 'Neuropeptide', receptors: ['V1a (Gq, vascular)', 'V1b (Gq, pituitary)', 'V2 (Gs, renal)'], functions: ['Water reabsorption', 'Blood pressure regulation', 'Social recognition', 'Aggression', 'Pair bonding', 'Stress response'], disorders: ['Diabetes insipidus', 'SIADH', 'Autism (social deficits)'], drugs: ['Desmopressin (V2 agonist)', 'Conivaptan (V1a/V2 antagonist)', 'Tolvaptan (V2 antagonist)'], synthesis: 'Synthesized in paraventricular and supraoptic nuclei of hypothalamus' },
  orexin: { name: 'Orexin (Hypocretin)', type: 'Neuropeptide', receptors: ['OX1R (Gq)', 'OX2R (Gq/Gi)'], functions: ['Wakefulness promotion', 'Appetite regulation', 'Reward seeking', 'Arousal', 'Energy homeostasis', 'Stabilize sleep-wake transitions'], disorders: ['Narcolepsy type 1 (orexin deficiency)', 'Insomnia', 'Addiction'], drugs: ['Suvorexant (dual OX1/OX2 antagonist, insomnia)', 'Lemborexant', 'Modafinil (indirect orexin activation)'], synthesis: 'Prepro-orexin → Orexin-A and Orexin-B (in lateral hypothalamus only)' },
  crf: { name: 'Corticotropin-Releasing Factor (CRF)', type: 'Neuropeptide', receptors: ['CRF1 (Gs)', 'CRF2 (Gs)'], functions: ['HPA axis activation', 'Stress response initiation', 'Anxiety', 'Appetite suppression (acute stress)', 'Immune modulation'], disorders: ['Depression', 'Anxiety', 'PTSD', "Cushing's disease", 'Anorexia nervosa'], drugs: ['Antalarmin (CRF1 antagonist, experimental)', 'Pexacerfont (experimental)'], synthesis: 'Synthesized in paraventricular nucleus of hypothalamus' },
  cholecystokinin: { name: 'Cholecystokinin (CCK)', type: 'Neuropeptide', receptors: ['CCK-A (CCK1, Gq, peripheral)', 'CCK-B (CCK2, Gq, central)'], functions: ['Satiety signaling', 'Anxiety/panic', 'Pain modulation', 'Memory', 'Gallbladder contraction', 'Pancreatic enzyme secretion'], disorders: ['Panic disorder', 'Schizophrenia', 'Eating disorders'], drugs: ['CCK-4 (panicogenic, research)', 'Devazepide (CCK-A antagonist, experimental)'], synthesis: 'Preprocholecystokinin → CCK (proteolytic cleavage, multiple active forms)' },
  nitric_oxide: { name: 'Nitric Oxide (NO)', type: 'Gasotransmitter', receptors: ['Soluble guanylyl cyclase (sGC) → cGMP'], functions: ['Vasodilation', 'Retrograde neurotransmission', 'Synaptic plasticity (LTP)', 'Immune defense', 'Neurotoxicity (excess)'], disorders: ['Migraine', 'Stroke', 'Erectile dysfunction', 'Neurodegenerative diseases'], drugs: ['Sildenafil (PDE5 inhibitor, preserves NO/cGMP)', 'Nitroglycerin (NO donor)', 'L-NAME (NOS inhibitor, research)'], synthesis: 'L-Arginine → NO + Citrulline (nitric oxide synthase / NOS: nNOS, eNOS, iNOS)' },
  adenosine: { name: 'Adenosine', type: 'Purine', receptors: ['A1 (Gi, inhibitory)', 'A2A (Gs, excitatory)', 'A2B (Gs)', 'A3 (Gi)'], functions: ['Sleep pressure accumulation', 'Neuroprotection', 'Vasodilation', 'Anti-inflammatory', 'Modulation of neurotransmitter release'], disorders: ['Insomnia', 'Epilepsy', 'Parkinson\'s disease', 'Pain'], drugs: ['Caffeine (A1/A2A antagonist)', 'Theophylline (antagonist)', 'Istradefylline (A2A antagonist, Parkinson\'s)', 'Adenosine injection (antiarrhythmic)'], synthesis: 'ATP → ADP → AMP → Adenosine (5\'-nucleotidase); accumulates with neural activity' },
  atp_purinergic: { name: 'ATP (Purinergic signaling)', type: 'Purine', receptors: ['P2X1-7 (ionotropic)', 'P2Y1-14 (metabotropic)'], functions: ['Fast excitatory transmission', 'Pain signaling', 'Microglia activation', 'Neuron-glia communication', 'Bladder control'], disorders: ['Chronic pain', 'Migraine', 'Urinary incontinence', 'Neuroinflammation'], drugs: ['Suramin (P2 antagonist)', 'Clopidogrel (P2Y12 antagonist)', 'Ticagrelor'], synthesis: 'Released from synaptic vesicles; co-released with other neurotransmitters' },
  endocannabinoids: { name: 'Endocannabinoids (Anandamide, 2-AG)', type: 'Lipid', receptors: ['CB1 (Gi, CNS)', 'CB2 (Gi, immune)', 'TRPV1 (anandamide)'], functions: ['Retrograde signaling', 'Synaptic plasticity', 'Pain modulation', 'Appetite regulation', 'Mood', 'Memory extinction', 'Neuroprotection'], disorders: ['Chronic pain', 'Anxiety', 'PTSD', 'Epilepsy', 'Multiple sclerosis', 'Obesity'], drugs: ['THC (CB1 partial agonist)', 'CBD (indirect)', 'Rimonabant (CB1 inverse agonist, withdrawn)', 'Epidiolex (CBD, epilepsy)', 'Nabilone (synthetic THC)'], synthesis: 'Anandamide: NAPE-PLD pathway on demand; 2-AG: DAGLα pathway; synthesized postsynaptically' },
  taurine: { name: 'Taurine', type: 'Amino acid (inhibitory)', receptors: ['Glycine receptors', 'GABA-A receptors (weak)', 'Taurine receptors (proposed)'], functions: ['Inhibitory neuromodulation', 'Osmoregulation', 'Calcium homeostasis', 'Neuroprotection', 'Retinal development'], disorders: ['Epilepsy', 'Retinal degeneration', 'Cardiomyopathy'], drugs: ['Taurine supplement', 'Acamprosate (partial GABA-A/taurine mechanism)'], synthesis: 'Cysteine → Cysteinesulfinic acid → Hypotaurine → Taurine (cysteine dioxygenase pathway)' },
  d_serine: { name: 'D-Serine', type: 'Amino acid (co-agonist)', receptors: ['NMDA receptor (glycine site co-agonist)'], functions: ['NMDA receptor activation', 'Synaptic plasticity', 'Learning and memory', 'Neurodevelopment'], disorders: ['Schizophrenia (NMDA hypofunction)', 'ALS', "Alzheimer's disease"], drugs: ['D-serine (experimental schizophrenia adjunct)', 'D-cycloserine (partial agonist)'], synthesis: 'L-Serine → D-Serine (serine racemase); primarily in astrocytes' },
  agmatine: { name: 'Agmatine', type: 'Amino acid derivative', receptors: ['Imidazoline receptors (I1, I2)', 'α2-adrenergic receptors', 'NMDA receptor (blocker)', 'Nicotinic receptors'], functions: ['Neuromodulation', 'Pain reduction', 'Neuroprotection', 'Insulin secretion', 'Nitric oxide modulation'], disorders: ['Depression', 'Neuropathic pain', 'Addiction'], drugs: ['Agmatine supplement (experimental)', 'Moxonidine (I1 agonist)'], synthesis: 'Arginine → Agmatine (arginine decarboxylase)' },
  hydrogen_sulfide: { name: 'Hydrogen Sulfide (H₂S)', type: 'Gasotransmitter', receptors: ['KATP channels', 'NMDA receptor modulation', 'TRPA1'], functions: ['Neuromodulation', 'Vasodilation', 'Anti-inflammatory', 'Synaptic plasticity', 'Neuroprotection (low doses)'], disorders: ['Hypertension', 'Neurodegenerative diseases', 'Inflammation'], drugs: ['NaHS (H₂S donor, research)', 'GYY4137 (slow-release donor)', 'AOAA (CBS inhibitor)'], synthesis: 'Cysteine → H₂S (cystathionine β-synthase / CBS; cystathionine γ-lyase / CSE)' },
  melatonin: { name: 'Melatonin', type: 'Indolamine (hormone/neuromodulator)', receptors: ['MT1 (Gi)', 'MT2 (Gi)'], functions: ['Circadian rhythm entrainment', 'Sleep onset promotion', 'Antioxidant', 'Immune modulation', 'Seasonal reproduction'], disorders: ['Insomnia', 'Circadian rhythm disorders', 'Jet lag', 'Seasonal affective disorder', 'Delayed sleep phase disorder'], drugs: ['Melatonin supplement', 'Ramelteon (MT1/MT2 agonist)', 'Tasimelteon (MT1/MT2 agonist)', 'Agomelatine (MT1/MT2 agonist + 5-HT2C antagonist)'], synthesis: 'Serotonin → N-acetylserotonin (AANAT) → Melatonin (HIOMT); in pineal gland, dark-dependent' },
  carbon_monoxide: { name: 'Carbon Monoxide (CO)', type: 'Gasotransmitter', receptors: ['Soluble guanylyl cyclase (sGC)', 'BKCa channels', 'Heme proteins'], functions: ['Anti-inflammatory', 'Vasodilation', 'Anti-apoptotic', 'Neurotransmission modulation'], disorders: ['CO poisoning (excess)', 'Neuroinflammation'], drugs: ['CO-releasing molecules (CORMs, experimental)'], synthesis: 'Heme → CO + Biliverdin (heme oxygenase / HO-1, HO-2)' },
}

// ─── Connectome Data (20 major regions, simplified structural connectivity) ──

interface ConnectomeRegion {
  name: string
  abbreviation: string
  lobe: string
}

const CONNECTOME_REGIONS: ConnectomeRegion[] = [
  { name: 'Prefrontal Cortex', abbreviation: 'PFC', lobe: 'Frontal' },
  { name: 'Primary Motor Cortex', abbreviation: 'M1', lobe: 'Frontal' },
  { name: 'Premotor Cortex', abbreviation: 'PMC', lobe: 'Frontal' },
  { name: 'Primary Somatosensory Cortex', abbreviation: 'S1', lobe: 'Parietal' },
  { name: 'Posterior Parietal Cortex', abbreviation: 'PPC', lobe: 'Parietal' },
  { name: 'Primary Visual Cortex', abbreviation: 'V1', lobe: 'Occipital' },
  { name: 'Visual Association Cortex', abbreviation: 'VAC', lobe: 'Occipital' },
  { name: 'Primary Auditory Cortex', abbreviation: 'A1', lobe: 'Temporal' },
  { name: 'Superior Temporal Sulcus', abbreviation: 'STS', lobe: 'Temporal' },
  { name: 'Inferior Temporal Cortex', abbreviation: 'ITC', lobe: 'Temporal' },
  { name: 'Hippocampus', abbreviation: 'HPC', lobe: 'Temporal (medial)' },
  { name: 'Amygdala', abbreviation: 'AMY', lobe: 'Temporal (medial)' },
  { name: 'Insula', abbreviation: 'INS', lobe: 'Insular' },
  { name: 'Cingulate Cortex', abbreviation: 'CNG', lobe: 'Limbic' },
  { name: 'Thalamus', abbreviation: 'THL', lobe: 'Diencephalon' },
  { name: 'Basal Ganglia', abbreviation: 'BG', lobe: 'Subcortical' },
  { name: 'Cerebellum', abbreviation: 'CBL', lobe: 'Hindbrain' },
  { name: 'Brainstem', abbreviation: 'BS', lobe: 'Hindbrain' },
  { name: 'Hypothalamus', abbreviation: 'HYP', lobe: 'Diencephalon' },
  { name: 'Nucleus Accumbens', abbreviation: 'NAc', lobe: 'Subcortical' },
]

// Adjacency matrix: connectivity[i][j] = strength (0-1, based on published DTI/tract-tracing data, simplified)
const CONNECTIVITY: number[][] = [
  //   PFC  M1  PMC  S1  PPC  V1  VAC  A1  STS  ITC  HPC  AMY  INS  CNG  THL  BG   CBL  BS   HYP  NAc
  [0.0,0.3,0.7,0.2,0.6,0.1,0.3,0.1,0.4,0.3,0.5,0.6,0.6,0.8,0.7,0.7,0.2,0.2,0.4,0.7], // PFC
  [0.3,0.0,0.8,0.7,0.4,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.3,0.6,0.7,0.6,0.5,0.1,0.1], // M1
  [0.7,0.8,0.0,0.5,0.6,0.1,0.2,0.1,0.2,0.1,0.1,0.1,0.2,0.4,0.5,0.6,0.5,0.3,0.1,0.1], // PMC
  [0.2,0.7,0.5,0.0,0.7,0.2,0.2,0.1,0.2,0.2,0.1,0.1,0.4,0.3,0.7,0.3,0.3,0.3,0.1,0.1], // S1
  [0.6,0.4,0.6,0.7,0.0,0.3,0.5,0.1,0.3,0.3,0.2,0.2,0.3,0.4,0.5,0.3,0.4,0.2,0.1,0.1], // PPC
  [0.1,0.1,0.1,0.2,0.3,0.0,0.8,0.1,0.2,0.4,0.1,0.1,0.1,0.1,0.6,0.1,0.1,0.2,0.0,0.0], // V1
  [0.3,0.1,0.2,0.2,0.5,0.8,0.0,0.1,0.4,0.6,0.2,0.2,0.2,0.2,0.4,0.1,0.1,0.1,0.0,0.0], // VAC
  [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.0,0.5,0.2,0.1,0.2,0.3,0.2,0.6,0.1,0.1,0.2,0.0,0.0], // A1
  [0.4,0.1,0.2,0.2,0.3,0.2,0.4,0.5,0.0,0.4,0.3,0.4,0.3,0.3,0.4,0.2,0.1,0.1,0.1,0.1], // STS
  [0.3,0.1,0.1,0.2,0.3,0.4,0.6,0.2,0.4,0.0,0.4,0.3,0.2,0.2,0.4,0.2,0.1,0.1,0.1,0.1], // ITC
  [0.5,0.1,0.1,0.1,0.2,0.1,0.2,0.1,0.3,0.4,0.0,0.7,0.2,0.5,0.5,0.2,0.1,0.1,0.3,0.3], // HPC
  [0.6,0.1,0.1,0.1,0.2,0.1,0.2,0.2,0.4,0.3,0.7,0.0,0.5,0.5,0.5,0.3,0.1,0.3,0.5,0.4], // AMY
  [0.6,0.2,0.2,0.4,0.3,0.1,0.2,0.3,0.3,0.2,0.2,0.5,0.0,0.6,0.5,0.3,0.1,0.3,0.3,0.2], // INS
  [0.8,0.3,0.4,0.3,0.4,0.1,0.2,0.2,0.3,0.2,0.5,0.5,0.6,0.0,0.5,0.4,0.2,0.2,0.3,0.3], // CNG
  [0.7,0.6,0.5,0.7,0.5,0.6,0.4,0.6,0.4,0.4,0.5,0.5,0.5,0.5,0.0,0.6,0.5,0.6,0.5,0.3], // THL
  [0.7,0.7,0.6,0.3,0.3,0.1,0.1,0.1,0.2,0.2,0.2,0.3,0.3,0.4,0.6,0.0,0.4,0.4,0.2,0.6], // BG
  [0.2,0.6,0.5,0.3,0.4,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.5,0.4,0.0,0.7,0.1,0.1], // CBL
  [0.2,0.5,0.3,0.3,0.2,0.2,0.1,0.2,0.1,0.1,0.1,0.3,0.3,0.2,0.6,0.4,0.7,0.0,0.5,0.1], // BS
  [0.4,0.1,0.1,0.1,0.1,0.0,0.0,0.0,0.1,0.1,0.3,0.5,0.3,0.3,0.5,0.2,0.1,0.5,0.0,0.3], // HYP
  [0.7,0.1,0.1,0.1,0.1,0.0,0.0,0.0,0.1,0.1,0.3,0.4,0.2,0.3,0.3,0.6,0.1,0.1,0.3,0.0], // NAc
]

// ─── MNI Coordinate Atlas (~50 key structures) ──────────────────────────────

interface MNICoord {
  name: string
  mni: { x: number; y: number; z: number }
  talairach: { x: number; y: number; z: number }
  brodmann?: string
}

const MNI_ATLAS: MNICoord[] = [
  { name: 'Left Primary Motor Cortex (hand)', mni: { x: -37, y: -25, z: 62 }, talairach: { x: -36, y: -25, z: 57 }, brodmann: 'BA 4' },
  { name: 'Right Primary Motor Cortex (hand)', mni: { x: 37, y: -25, z: 62 }, talairach: { x: 36, y: -25, z: 57 }, brodmann: 'BA 4' },
  { name: 'Left Primary Somatosensory Cortex', mni: { x: -42, y: -30, z: 55 }, talairach: { x: -41, y: -30, z: 50 }, brodmann: 'BA 1,2,3' },
  { name: 'Left DLPFC', mni: { x: -44, y: 36, z: 20 }, talairach: { x: -43, y: 34, z: 19 }, brodmann: 'BA 9/46' },
  { name: 'Right DLPFC', mni: { x: 44, y: 36, z: 20 }, talairach: { x: 43, y: 34, z: 19 }, brodmann: 'BA 9/46' },
  { name: 'Left VLPFC (Broca\'s area)', mni: { x: -48, y: 20, z: 8 }, talairach: { x: -47, y: 19, z: 8 }, brodmann: 'BA 44/45' },
  { name: 'Medial Prefrontal Cortex', mni: { x: 0, y: 52, z: 6 }, talairach: { x: 0, y: 50, z: 7 }, brodmann: 'BA 10/32' },
  { name: 'Orbitofrontal Cortex', mni: { x: 0, y: 42, z: -16 }, talairach: { x: 0, y: 41, z: -12 }, brodmann: 'BA 11' },
  { name: 'Anterior Cingulate Cortex (dorsal)', mni: { x: 0, y: 24, z: 32 }, talairach: { x: 0, y: 23, z: 30 }, brodmann: 'BA 32' },
  { name: 'Posterior Cingulate Cortex', mni: { x: 0, y: -50, z: 28 }, talairach: { x: 0, y: -49, z: 26 }, brodmann: 'BA 23/31' },
  { name: 'Left Hippocampus', mni: { x: -28, y: -20, z: -12 }, talairach: { x: -27, y: -20, z: -10 } },
  { name: 'Right Hippocampus', mni: { x: 28, y: -20, z: -12 }, talairach: { x: 27, y: -20, z: -10 } },
  { name: 'Left Amygdala', mni: { x: -24, y: -4, z: -18 }, talairach: { x: -23, y: -4, z: -15 } },
  { name: 'Right Amygdala', mni: { x: 24, y: -4, z: -18 }, talairach: { x: 23, y: -4, z: -15 } },
  { name: 'Left Insula (anterior)', mni: { x: -36, y: 16, z: 2 }, talairach: { x: -35, y: 15, z: 3 }, brodmann: 'BA 13' },
  { name: 'Right Insula (anterior)', mni: { x: 36, y: 16, z: 2 }, talairach: { x: 35, y: 15, z: 3 }, brodmann: 'BA 13' },
  { name: 'Left Thalamus', mni: { x: -10, y: -18, z: 8 }, talairach: { x: -10, y: -18, z: 8 } },
  { name: 'Right Thalamus', mni: { x: 10, y: -18, z: 8 }, talairach: { x: 10, y: -18, z: 8 } },
  { name: 'Left Caudate (head)', mni: { x: -12, y: 12, z: 8 }, talairach: { x: -12, y: 11, z: 8 } },
  { name: 'Right Caudate (head)', mni: { x: 12, y: 12, z: 8 }, talairach: { x: 12, y: 11, z: 8 } },
  { name: 'Left Putamen', mni: { x: -26, y: 4, z: 2 }, talairach: { x: -25, y: 4, z: 3 } },
  { name: 'Right Putamen', mni: { x: 26, y: 4, z: 2 }, talairach: { x: 25, y: 4, z: 3 } },
  { name: 'Left Globus Pallidus', mni: { x: -18, y: -2, z: 0 }, talairach: { x: -17, y: -2, z: 1 } },
  { name: 'Left Nucleus Accumbens', mni: { x: -10, y: 10, z: -8 }, talairach: { x: -10, y: 10, z: -6 } },
  { name: 'Right Nucleus Accumbens', mni: { x: 10, y: 10, z: -8 }, talairach: { x: 10, y: 10, z: -6 } },
  { name: 'Primary Visual Cortex (V1)', mni: { x: 0, y: -84, z: 4 }, talairach: { x: 0, y: -82, z: 4 }, brodmann: 'BA 17' },
  { name: 'Left V4 (color)', mni: { x: -30, y: -72, z: -12 }, talairach: { x: -29, y: -70, z: -10 }, brodmann: 'BA 19' },
  { name: 'Left V5/MT (motion)', mni: { x: -44, y: -68, z: 0 }, talairach: { x: -43, y: -66, z: 1 }, brodmann: 'BA 19/37' },
  { name: 'Left Primary Auditory Cortex', mni: { x: -48, y: -22, z: 8 }, talairach: { x: -47, y: -22, z: 8 }, brodmann: 'BA 41' },
  { name: 'Left Wernicke\'s Area', mni: { x: -56, y: -42, z: 14 }, talairach: { x: -55, y: -41, z: 14 }, brodmann: 'BA 22' },
  { name: 'Left Fusiform Gyrus (FFA)', mni: { x: -40, y: -54, z: -18 }, talairach: { x: -39, y: -53, z: -15 }, brodmann: 'BA 37' },
  { name: 'Right Fusiform Gyrus (FFA)', mni: { x: 40, y: -54, z: -18 }, talairach: { x: 39, y: -53, z: -15 }, brodmann: 'BA 37' },
  { name: 'Left Angular Gyrus', mni: { x: -44, y: -62, z: 36 }, talairach: { x: -43, y: -60, z: 34 }, brodmann: 'BA 39' },
  { name: 'Left Supramarginal Gyrus', mni: { x: -56, y: -40, z: 36 }, talairach: { x: -55, y: -39, z: 34 }, brodmann: 'BA 40' },
  { name: 'Precuneus', mni: { x: 0, y: -64, z: 44 }, talairach: { x: 0, y: -62, z: 42 }, brodmann: 'BA 7/31' },
  { name: 'Left SMA', mni: { x: -4, y: -2, z: 60 }, talairach: { x: -4, y: -2, z: 55 }, brodmann: 'BA 6' },
  { name: 'Left Frontal Eye Field', mni: { x: -30, y: -4, z: 52 }, talairach: { x: -29, y: -4, z: 48 }, brodmann: 'BA 8' },
  { name: 'Left Parahippocampal Gyrus', mni: { x: -24, y: -32, z: -12 }, talairach: { x: -23, y: -31, z: -10 }, brodmann: 'BA 36' },
  { name: 'Left Entorhinal Cortex', mni: { x: -22, y: -8, z: -26 }, talairach: { x: -21, y: -8, z: -22 }, brodmann: 'BA 28' },
  { name: 'Hypothalamus', mni: { x: 0, y: -4, z: -10 }, talairach: { x: 0, y: -4, z: -8 } },
  { name: 'Substantia Nigra', mni: { x: -10, y: -16, z: -10 }, talairach: { x: -10, y: -16, z: -8 } },
  { name: 'VTA', mni: { x: -4, y: -16, z: -14 }, talairach: { x: -4, y: -16, z: -12 } },
  { name: 'Periaqueductal Gray', mni: { x: 0, y: -32, z: -6 }, talairach: { x: 0, y: -31, z: -5 } },
  { name: 'Superior Colliculus', mni: { x: 0, y: -32, z: -2 }, talairach: { x: 0, y: -31, z: -1 } },
  { name: 'Cerebellar Vermis', mni: { x: 0, y: -62, z: -30 }, talairach: { x: 0, y: -60, z: -26 } },
  { name: 'Left Cerebellar Hemisphere', mni: { x: -30, y: -66, z: -30 }, talairach: { x: -29, y: -64, z: -26 } },
  { name: 'Right Cerebellar Hemisphere', mni: { x: 30, y: -66, z: -30 }, talairach: { x: 29, y: -64, z: -26 } },
  { name: 'Pons', mni: { x: 0, y: -24, z: -32 }, talairach: { x: 0, y: -24, z: -28 } },
  { name: 'Medulla', mni: { x: 0, y: -36, z: -48 }, talairach: { x: 0, y: -35, z: -43 } },
  { name: 'Left Locus Coeruleus', mni: { x: -4, y: -36, z: -26 }, talairach: { x: -4, y: -35, z: -23 } },
]

// ─── Registration ────────────────────────────────────────────────────────────

export function registerLabNeuroTools(): void {

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Brain Atlas
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'brain_atlas',
    description: 'Look up brain regions by name, function, or associated disorder. Returns detailed neuroanatomical information including Brodmann areas, functions, disorders, and connectivity for ~100 brain structures.',
    parameters: {
      query: { type: 'string', description: 'Region name, function, or disorder to search for', required: true },
      search_type: { type: 'string', description: 'Search type: region (by name), function (by function), disorder (by associated disorder). Default: region' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).toLowerCase()
      const searchType = String(args.search_type || 'region').toLowerCase()

      const matches: BrainRegion[] = []

      for (const [key, region] of Object.entries(BRAIN_ATLAS)) {
        let match = false
        if (searchType === 'region' || searchType === 'name') {
          match = key.includes(query) ||
            region.name.toLowerCase().includes(query) ||
            (region.brodmann?.toLowerCase().includes(query) ?? false)
        } else if (searchType === 'function') {
          match = region.functions.some(f => f.toLowerCase().includes(query))
        } else if (searchType === 'disorder') {
          match = region.disorders.some(d => d.toLowerCase().includes(query))
        } else {
          // Search all fields
          match = key.includes(query) ||
            region.name.toLowerCase().includes(query) ||
            region.functions.some(f => f.toLowerCase().includes(query)) ||
            region.disorders.some(d => d.toLowerCase().includes(query))
        }
        if (match) matches.push(region)
      }

      if (matches.length === 0) {
        return `No brain regions found matching "${args.query}" (search_type: ${searchType}).\n\nTry broader terms or switch search_type (region/function/disorder).`
      }

      const parts = [`## Brain Atlas Results (${matches.length} matches for "${args.query}")\n`]

      for (const r of matches.slice(0, 15)) {
        parts.push(`### ${r.name}`)
        parts.push(`- **Location**: ${r.location}`)
        if (r.brodmann) parts.push(`- **Brodmann Area**: ${r.brodmann}`)
        parts.push(`- **Functions**: ${r.functions.join(', ')}`)
        parts.push(`- **Associated Disorders**: ${r.disorders.join(', ')}`)
        parts.push(`- **Connections**: ${r.connections.join(', ')}`)
        parts.push('')
      }

      if (matches.length > 15) {
        parts.push(`\n*...and ${matches.length - 15} more matches. Narrow your query for more specific results.*`)
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 2. EEG Analyze
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'eeg_analyze',
    description: 'Analyze EEG-like time series data. Computes power spectral density (FFT), band power (delta/theta/alpha/beta/gamma), peak frequency, spectral edge frequency, and clinical band ratios (theta/beta for ADHD, alpha asymmetry).',
    parameters: {
      signal: { type: 'string', description: 'Comma-separated signal samples (amplitude values)', required: true },
      sample_rate: { type: 'number', description: 'Sampling rate in Hz (default: 256)' },
      analysis: { type: 'string', description: 'Analysis type: spectrum, bands, ratios, all (default: all)' },
    },
    tier: 'free',
    async execute(args) {
      const samples = String(args.signal).split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
      const fs = typeof args.sample_rate === 'number' ? args.sample_rate : 256
      const analysis = String(args.analysis || 'all').toLowerCase()

      if (samples.length < 8) {
        return 'Error: Need at least 8 samples for spectral analysis.'
      }

      // Zero-pad to next power of 2
      let N = 1
      while (N < samples.length) N *= 2
      const padded = new Array(N).fill(0)
      for (let i = 0; i < samples.length; i++) padded[i] = samples[i]

      // Remove DC offset
      const mean = padded.reduce((a, b) => a + b, 0) / samples.length
      for (let i = 0; i < samples.length; i++) padded[i] -= mean

      // Apply Hanning window
      for (let i = 0; i < samples.length; i++) {
        padded[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples.length - 1)))
      }

      // FFT (Cooley-Tukey radix-2)
      function fft(re: number[], im: number[]): void {
        const n = re.length
        // Bit-reversal permutation
        for (let i = 1, j = 0; i < n; i++) {
          let bit = n >> 1
          for (; j & bit; bit >>= 1) j ^= bit
          j ^= bit
          if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]]
          }
        }
        // Butterfly operations
        for (let len = 2; len <= n; len *= 2) {
          const ang = -2 * Math.PI / len
          const wRe = Math.cos(ang)
          const wIm = Math.sin(ang)
          for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0
            for (let j = 0; j < len / 2; j++) {
              const uRe = re[i + j], uIm = im[i + j]
              const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm
              const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe
              re[i + j] = uRe + vRe
              im[i + j] = uIm + vIm
              re[i + j + len / 2] = uRe - vRe
              im[i + j + len / 2] = uIm - vIm
              const newCurRe = curRe * wRe - curIm * wIm
              curIm = curRe * wIm + curIm * wRe
              curRe = newCurRe
            }
          }
        }
      }

      const re = [...padded]
      const im = new Array(N).fill(0)
      fft(re, im)

      // Power spectral density (one-sided)
      const nFreqs = Math.floor(N / 2) + 1
      const freqRes = fs / N
      const psd: number[] = []
      const freqs: number[] = []
      for (let i = 0; i < nFreqs; i++) {
        freqs.push(i * freqRes)
        let power = (re[i] * re[i] + im[i] * im[i]) / (N * N)
        if (i > 0 && i < N / 2) power *= 2  // one-sided
        psd.push(power)
      }

      // Band power computation
      function bandPower(fLow: number, fHigh: number): number {
        let sum = 0
        for (let i = 0; i < nFreqs; i++) {
          if (freqs[i] >= fLow && freqs[i] < fHigh) sum += psd[i]
        }
        return sum * freqRes
      }

      const bands = {
        delta: bandPower(0.5, 4),
        theta: bandPower(4, 8),
        alpha: bandPower(8, 13),
        beta: bandPower(13, 30),
        gamma: bandPower(30, Math.min(100, fs / 2)),
      }

      const totalPower = Object.values(bands).reduce((a, b) => a + b, 0)

      // Peak frequency (highest power in 1-50 Hz range)
      let peakFreq = 0
      let peakPower = 0
      for (let i = 0; i < nFreqs; i++) {
        if (freqs[i] >= 1 && freqs[i] <= 50 && psd[i] > peakPower) {
          peakPower = psd[i]
          peakFreq = freqs[i]
        }
      }

      // Spectral edge frequency (95% of power)
      let cumPower = 0
      const totalPSD = psd.reduce((a, b) => a + b, 0) * freqRes
      let sef95 = freqs[nFreqs - 1]
      for (let i = 0; i < nFreqs; i++) {
        cumPower += psd[i] * freqRes
        if (cumPower >= 0.95 * totalPSD) {
          sef95 = freqs[i]
          break
        }
      }

      const parts: string[] = ['## EEG Analysis Results\n']
      parts.push(`- **Samples**: ${samples.length} | **Sample rate**: ${fs} Hz | **Duration**: ${fmt(samples.length / fs, 3)} s`)
      parts.push(`- **Frequency resolution**: ${fmt(freqRes, 3)} Hz | **Nyquist**: ${fs / 2} Hz`)
      parts.push('')

      if (analysis === 'spectrum' || analysis === 'all') {
        parts.push('### Power Spectral Density (top 20 frequencies)')
        const sorted = freqs.map((f, i) => ({ freq: f, power: psd[i] }))
          .filter(p => p.freq >= 0.5 && p.freq <= Math.min(100, fs / 2))
          .sort((a, b) => b.power - a.power)
          .slice(0, 20)
        parts.push('| Frequency (Hz) | Power (uV^2/Hz) | Relative % |')
        parts.push('|---|---|---|')
        for (const p of sorted) {
          parts.push(`| ${fmt(p.freq, 4)} | ${fmt(p.power, 4)} | ${fmt(totalPSD > 0 ? (p.power / totalPSD) * 100 : 0, 3)}% |`)
        }
        parts.push('')
      }

      if (analysis === 'bands' || analysis === 'all') {
        parts.push('### Band Power')
        parts.push('| Band | Range (Hz) | Absolute Power | Relative % | Typical State |')
        parts.push('|---|---|---|---|---|')
        parts.push(`| Delta | 0.5-4 | ${fmt(bands.delta, 4)} | ${fmt(totalPower > 0 ? (bands.delta / totalPower) * 100 : 0, 3)}% | Deep sleep, unconscious |`)
        parts.push(`| Theta | 4-8 | ${fmt(bands.theta, 4)} | ${fmt(totalPower > 0 ? (bands.theta / totalPower) * 100 : 0, 3)}% | Drowsy, meditation, memory |`)
        parts.push(`| Alpha | 8-13 | ${fmt(bands.alpha, 4)} | ${fmt(totalPower > 0 ? (bands.alpha / totalPower) * 100 : 0, 3)}% | Relaxed, eyes closed |`)
        parts.push(`| Beta | 13-30 | ${fmt(bands.beta, 4)} | ${fmt(totalPower > 0 ? (bands.beta / totalPower) * 100 : 0, 3)}% | Alert, active thinking |`)
        parts.push(`| Gamma | 30-100 | ${fmt(bands.gamma, 4)} | ${fmt(totalPower > 0 ? (bands.gamma / totalPower) * 100 : 0, 3)}% | Cognitive binding, consciousness |`)
        parts.push('')
        parts.push(`- **Peak frequency**: ${fmt(peakFreq, 4)} Hz`)
        parts.push(`- **Spectral edge (95%)**: ${fmt(sef95, 4)} Hz`)
        parts.push(`- **Total band power**: ${fmt(totalPower, 4)}`)
        parts.push('')
      }

      if (analysis === 'ratios' || analysis === 'all') {
        parts.push('### Clinical Ratios')
        const thetaBeta = bands.beta > 0 ? bands.theta / bands.beta : Infinity
        const alphabeta = bands.beta > 0 ? bands.alpha / bands.beta : Infinity
        const thetaAlpha = bands.alpha > 0 ? bands.theta / bands.alpha : Infinity
        const deltaAlpha = bands.alpha > 0 ? bands.delta / bands.alpha : Infinity

        parts.push(`| Ratio | Value | Clinical Relevance |`)
        parts.push(`|---|---|---|`)
        parts.push(`| Theta/Beta | ${fmt(thetaBeta, 3)} | ADHD marker (elevated >3.0 in children) |`)
        parts.push(`| Alpha/Beta | ${fmt(alphabeta, 3)} | Relaxation vs alertness index |`)
        parts.push(`| Theta/Alpha | ${fmt(thetaAlpha, 3)} | Drowsiness index (elevated = drowsy) |`)
        parts.push(`| Delta/Alpha | ${fmt(deltaAlpha, 3)} | Encephalopathy marker (elevated = abnormal) |`)
        parts.push('')

        // Dominant band
        const bandEntries = Object.entries(bands)
        bandEntries.sort((a, b) => b[1] - a[1])
        parts.push(`**Dominant band**: ${bandEntries[0][0]} (${fmt((bandEntries[0][1] / totalPower) * 100, 3)}% of total power)`)
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 3. Cognitive Model
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'cognitive_model',
    description: 'Implement classic cognitive science models: Hick\'s law (RT vs choices), Fitts\'s law (movement time), Stevens\' power law, Weber-Fechner law, signal detection theory (d-prime), drift-diffusion model.',
    parameters: {
      model: { type: 'string', description: 'Model: hicks, fitts, stevens, weber, sdt, ddm', required: true },
      params: { type: 'string', description: 'JSON with model-specific parameters (see description)', required: true },
    },
    tier: 'free',
    async execute(args) {
      const model = String(args.model).toLowerCase()
      const p = safeJSON(String(args.params)) as Record<string, unknown> | null
      if (!p) return 'Error: params must be valid JSON.'

      const parts: string[] = []

      if (model === 'hicks' || model === 'hick') {
        // Hick's Law: RT = a + b * log2(n)
        const n = Number(p.n || p.choices || 2)
        const a = Number(p.a || p.intercept || 200)  // ms
        const b = Number(p.b || p.slope || 150)       // ms/bit
        const items = typeof p.items === 'object' && Array.isArray(p.items) ? p.items.map(Number) : [1, 2, 4, 8, 16, 32]

        parts.push("## Hick's Law")
        parts.push(`**Formula**: RT = a + b * log₂(n + 1)`)
        parts.push(`**Parameters**: a = ${a} ms (intercept), b = ${b} ms/bit (slope)`)
        parts.push('')
        parts.push('| Choices (n) | Information (bits) | Predicted RT (ms) |')
        parts.push('|---|---|---|')
        for (const ni of items) {
          const bits = Math.log2(ni + 1)
          const rt = a + b * bits
          parts.push(`| ${ni} | ${fmt(bits, 3)} | ${fmt(rt, 4)} |`)
        }
        parts.push('')
        parts.push(`**For n=${n}**: RT = ${fmt(a + b * Math.log2(n + 1), 4)} ms (${fmt(Math.log2(n + 1), 3)} bits)`)
        parts.push('')
        parts.push('*Note: Uses Hyman (1953) formulation with n+1 to account for uncertainty*')

      } else if (model === 'fitts') {
        // Fitts's Law: MT = a + b * log2(2D/W)
        const D = Number(p.D || p.distance || 100)   // distance (px or mm)
        const W = Number(p.W || p.width || 10)        // target width
        const a = Number(p.a || p.intercept || 50)     // ms
        const b = Number(p.b || p.slope || 150)        // ms/bit

        const ID = Math.log2(2 * D / W)
        const MT = a + b * ID

        parts.push("## Fitts's Law")
        parts.push(`**Formula**: MT = a + b * log₂(2D/W) = a + b * ID`)
        parts.push(`**Parameters**: a = ${a} ms, b = ${b} ms/bit`)
        parts.push(`**Input**: D = ${D}, W = ${W}`)
        parts.push('')
        parts.push(`- **Index of Difficulty (ID)**: ${fmt(ID, 4)} bits`)
        parts.push(`- **Movement Time (MT)**: ${fmt(MT, 4)} ms`)
        parts.push(`- **Throughput (IP)**: ${fmt(ID / (MT / 1000), 4)} bits/s`)
        parts.push('')

        // Generate table for varying distances
        parts.push('### Predicted MT for varying distances')
        parts.push('| Distance | ID (bits) | MT (ms) |')
        parts.push('|---|---|---|')
        for (const d of [50, 100, 200, 400, 800]) {
          const id = Math.log2(2 * d / W)
          parts.push(`| ${d} | ${fmt(id, 3)} | ${fmt(a + b * id, 4)} |`)
        }
        parts.push('')
        parts.push('*Shannon formulation (MacKenzie, 1992): ID = log₂(D/W + 1)*')

      } else if (model === 'stevens') {
        // Stevens' Power Law: ψ = k * S^n
        const S = Number(p.S || p.stimulus || p.intensity || 100)
        const n = Number(p.n || p.exponent || 1.0)
        const k = Number(p.k || p.constant || 1.0)
        const modality = String(p.modality || 'custom')

        // Known exponents for sensory modalities
        const exponents: Record<string, { n: number; desc: string }> = {
          brightness: { n: 0.33, desc: 'Brightness (5° target in dark)' },
          loudness: { n: 0.67, desc: 'Loudness (3000 Hz tone)' },
          vibration: { n: 0.95, desc: 'Vibration (60 Hz on finger)' },
          taste_salt: { n: 1.3, desc: 'Taste (salt)' },
          heaviness: { n: 1.45, desc: 'Heaviness (lifted weights)' },
          length: { n: 1.0, desc: 'Visual length' },
          electric_shock: { n: 3.5, desc: 'Electric shock (60 Hz through fingers)' },
          temperature_warmth: { n: 1.6, desc: 'Temperature (warmth on arm)' },
          temperature_cold: { n: 1.0, desc: 'Temperature (cold on arm)' },
          pressure: { n: 1.1, desc: 'Pressure on palm' },
          smell: { n: 0.6, desc: 'Smell (heptane)' },
        }

        parts.push("## Stevens' Power Law")
        parts.push(`**Formula**: \u03C8 = k \u00D7 S^n`)
        parts.push(`**Parameters**: k = ${k}, n = ${n}`)
        parts.push(`**Stimulus intensity**: S = ${S}`)
        parts.push(`**Perceived magnitude**: \u03C8 = ${fmt(k * Math.pow(S, n), 6)}`)
        parts.push('')

        if (modality !== 'custom' && exponents[modality]) {
          const e = exponents[modality]
          parts.push(`**Modality**: ${e.desc} (exponent = ${e.n})`)
          parts.push(`**Perceived magnitude** (standard exponent): ${fmt(k * Math.pow(S, e.n), 6)}`)
          parts.push('')
        }

        parts.push('### Known Exponents by Modality')
        parts.push('| Modality | Exponent (n) | Effect |')
        parts.push('|---|---|---|')
        for (const [, e] of Object.entries(exponents)) {
          const effect = e.n < 1 ? 'Compressive (diminishing returns)' : e.n === 1 ? 'Linear' : 'Expansive (accelerating)'
          parts.push(`| ${e.desc} | ${e.n} | ${effect} |`)
        }

      } else if (model === 'weber' || model === 'weber_fechner' || model === 'fechner') {
        // Weber-Fechner: ΔI/I = k (Weber), ψ = k * ln(S/S0) (Fechner)
        const I = Number(p.I || p.intensity || p.stimulus || 100)
        const deltaI = Number(p.deltaI || p.jnd || 0)
        const k = Number(p.k || p.weber_fraction || 0)
        const S0 = Number(p.S0 || p.threshold || 1)

        const knownFractions: Record<string, { k: number; desc: string }> = {
          brightness: { k: 0.079, desc: 'Brightness' },
          loudness: { k: 0.048, desc: 'Loudness (1000 Hz)' },
          weight: { k: 0.020, desc: 'Heaviness (lifted weights)' },
          pitch: { k: 0.003, desc: 'Pitch (2000 Hz)' },
          taste_salt: { k: 0.083, desc: 'Taste (salt concentration)' },
          smell: { k: 0.104, desc: 'Smell (rubber)' },
          vibration: { k: 0.036, desc: 'Vibration (230 Hz)' },
          pressure: { k: 0.136, desc: 'Pressure on skin' },
          line_length: { k: 0.029, desc: 'Visual line length' },
          electric_shock: { k: 0.013, desc: 'Electric shock' },
        }

        parts.push('## Weber-Fechner Law')
        parts.push('')
        parts.push("**Weber's Law**: \u0394I / I = k (constant)")
        parts.push("**Fechner's Law**: \u03C8 = c \u00D7 ln(S / S\u2080)")
        parts.push('')

        if (k > 0) {
          parts.push(`**Weber fraction (k)**: ${k}`)
          parts.push(`**Stimulus intensity (I)**: ${I}`)
          parts.push(`**JND (\u0394I)**: ${fmt(I * k, 6)}`)
        } else if (deltaI > 0) {
          parts.push(`**Stimulus intensity (I)**: ${I}`)
          parts.push(`**JND (\u0394I)**: ${deltaI}`)
          parts.push(`**Weber fraction (k)**: ${fmt(deltaI / I, 6)}`)
        }

        parts.push('')
        parts.push(`**Fechner perceived magnitude**: \u03C8 = ${fmt(Math.log(I / S0), 6)} (with S\u2080 = ${S0})`)
        parts.push('')

        parts.push('### JND at Different Intensities (k = ' + (k || 0.05) + ')')
        parts.push('| Intensity | JND | Fechner \u03C8 |')
        parts.push('|---|---|---|')
        const wk = k || 0.05
        for (const intensity of [10, 25, 50, 100, 250, 500, 1000]) {
          parts.push(`| ${intensity} | ${fmt(intensity * wk, 4)} | ${fmt(Math.log(intensity / S0), 4)} |`)
        }
        parts.push('')

        parts.push('### Known Weber Fractions')
        parts.push('| Modality | Weber Fraction | Sensitivity |')
        parts.push('|---|---|---|')
        for (const [, f] of Object.entries(knownFractions)) {
          parts.push(`| ${f.desc} | ${f.k} | ${f.k < 0.05 ? 'High' : f.k < 0.1 ? 'Medium' : 'Low'} |`)
        }

      } else if (model === 'sdt' || model === 'signal_detection') {
        // Signal Detection Theory
        const hits = Number(p.hits || 0)
        const misses = Number(p.misses || 0)
        const falseAlarms = Number(p.false_alarms || p.fa || 0)
        const correctRejections = Number(p.correct_rejections || p.cr || 0)

        const signalTrials = hits + misses
        const noiseTrials = falseAlarms + correctRejections

        if (signalTrials === 0 || noiseTrials === 0) {
          return 'Error: Need non-zero signal trials (hits+misses) and noise trials (false_alarms+correct_rejections).'
        }

        // Hit rate and false alarm rate (with correction for 0 and 1)
        let HR = hits / signalTrials
        let FAR = falseAlarms / noiseTrials
        // Log-linear correction (Hautus, 1995)
        if (HR === 0) HR = 0.5 / signalTrials
        if (HR === 1) HR = 1 - 0.5 / signalTrials
        if (FAR === 0) FAR = 0.5 / noiseTrials
        if (FAR === 1) FAR = 1 - 0.5 / noiseTrials

        // z-score (probit) via rational approximation
        function normInv(p: number): number {
          // Abramowitz & Stegun approximation
          if (p <= 0) return -8
          if (p >= 1) return 8
          const t = p < 0.5 ? p : 1 - p
          const s = Math.sqrt(-2 * Math.log(t))
          const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328
          const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308
          let z = s - (c0 + c1 * s + c2 * s * s) / (1 + d1 * s + d2 * s * s + d3 * s * s * s)
          if (p < 0.5) z = -z
          return z
        }

        const zHR = normInv(HR)
        const zFAR = normInv(FAR)

        const dPrime = zHR - zFAR
        const criterion = -0.5 * (zHR + zFAR)
        const beta = Math.exp(-0.5 * (zHR * zHR - zFAR * zFAR))
        const accuracy = (hits + correctRejections) / (signalTrials + noiseTrials)

        // A' (nonparametric sensitivity)
        let aPrime: number
        if (HR >= FAR) {
          aPrime = 0.5 + ((HR - FAR) * (1 + HR - FAR)) / (4 * HR * (1 - FAR))
        } else {
          aPrime = 0.5 - ((FAR - HR) * (1 + FAR - HR)) / (4 * FAR * (1 - HR))
        }

        parts.push('## Signal Detection Theory Analysis')
        parts.push('')
        parts.push('### Confusion Matrix')
        parts.push('|  | Signal Present | Signal Absent |')
        parts.push('|---|---|---|')
        parts.push(`| **"Yes"** | Hits: ${hits} | False Alarms: ${falseAlarms} |`)
        parts.push(`| **"No"** | Misses: ${misses} | Correct Rejections: ${correctRejections} |`)
        parts.push('')
        parts.push('### Rates')
        parts.push(`- **Hit Rate (HR)**: ${fmt(HR, 4)}`)
        parts.push(`- **False Alarm Rate (FAR)**: ${fmt(FAR, 4)}`)
        parts.push(`- **Miss Rate**: ${fmt(1 - HR, 4)}`)
        parts.push(`- **Correct Rejection Rate**: ${fmt(1 - FAR, 4)}`)
        parts.push(`- **Overall Accuracy**: ${fmt(accuracy * 100, 4)}%`)
        parts.push('')
        parts.push('### SDT Measures')
        parts.push(`- **d\' (sensitivity)**: ${fmt(dPrime, 4)} — ${dPrime > 2 ? 'High' : dPrime > 1 ? 'Moderate' : dPrime > 0 ? 'Low' : 'At chance'} discriminability`)
        parts.push(`- **c (criterion)**: ${fmt(criterion, 4)} — ${criterion > 0.5 ? 'Conservative' : criterion < -0.5 ? 'Liberal' : 'Neutral'} bias`)
        parts.push(`- **\u03B2 (likelihood ratio)**: ${fmt(beta, 4)} — ${beta > 1 ? 'Conservative' : beta < 1 ? 'Liberal' : 'Optimal'} bias`)
        parts.push(`- **A\' (nonparametric)**: ${fmt(aPrime, 4)}`)
        parts.push('')
        parts.push('### Interpretation')
        if (dPrime > 2) {
          parts.push('The observer shows strong ability to distinguish signal from noise.')
        } else if (dPrime > 1) {
          parts.push('The observer shows moderate discriminability. Performance is above chance but imperfect.')
        } else if (dPrime > 0) {
          parts.push('The observer shows weak discriminability. Near-chance performance.')
        } else {
          parts.push('The observer cannot distinguish signal from noise (d\' ~ 0).')
        }

      } else if (model === 'ddm' || model === 'drift_diffusion') {
        // Drift-Diffusion Model (simplified analytical solution)
        const v = Number(p.v || p.drift || 0.3)        // drift rate
        const a = Number(p.a || p.threshold || 1.0)     // decision boundary
        const z = Number(p.z || p.bias || 0.5)          // starting point (0-1, proportion of a)
        const t0 = Number(p.t0 || p.nondecision || 0.3) // non-decision time (s)
        const s = Number(p.s || p.noise || 0.1)         // diffusion coefficient

        const zAbs = z * a

        // Analytical solutions (for unbiased start, z=a/2)
        // Mean RT for correct responses (approximation)
        const meanRT_correct = t0 + (a / (2 * v)) * Math.tanh(v * a / (2 * s * s))
        // Accuracy (probability of correct response)
        const accuracy = 1 / (1 + Math.exp(-2 * v * a / (s * s)))

        // Simple simulation
        const nSim = 2000
        const dt = 0.001
        let correctCount = 0
        let totalRT = 0
        let totalCorrectRT = 0
        let totalErrorRT = 0
        let errorCount = 0
        const rtDist: number[] = []

        for (let trial = 0; trial < nSim; trial++) {
          let x = zAbs
          let t = 0
          while (x > 0 && x < a && t < 10) {
            x += v * dt + s * Math.sqrt(dt) * gaussianRandom()
            t += dt
          }
          const rt = t + t0
          totalRT += rt
          if (x >= a) {
            correctCount++
            totalCorrectRT += rt
            rtDist.push(rt)
          } else {
            errorCount++
            totalErrorRT += rt
          }
        }

        const simAccuracy = correctCount / nSim
        const simMeanRT = totalRT / nSim
        const simMeanCorrectRT = correctCount > 0 ? totalCorrectRT / correctCount : 0
        const simMeanErrorRT = errorCount > 0 ? totalErrorRT / errorCount : 0

        parts.push('## Drift-Diffusion Model')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **v (drift rate)**: ${v} — strength of evidence accumulation`)
        parts.push(`- **a (boundary)**: ${a} — decision threshold (speed-accuracy tradeoff)`)
        parts.push(`- **z (start point)**: ${z} (${fmt(zAbs, 3)} absolute) — bias`)
        parts.push(`- **t\u2080 (non-decision)**: ${t0} s — encoding + motor time`)
        parts.push(`- **s (noise)**: ${s} — within-trial variability`)
        parts.push('')
        parts.push('### Analytical Predictions')
        parts.push(`- **Predicted accuracy**: ${fmt(accuracy * 100, 4)}%`)
        parts.push(`- **Predicted mean RT**: ${fmt(meanRT_correct * 1000, 4)} ms`)
        parts.push('')
        parts.push(`### Simulation Results (${nSim} trials)`)
        parts.push(`- **Simulated accuracy**: ${fmt(simAccuracy * 100, 4)}%`)
        parts.push(`- **Mean RT (all)**: ${fmt(simMeanRT * 1000, 4)} ms`)
        parts.push(`- **Mean RT (correct)**: ${fmt(simMeanCorrectRT * 1000, 4)} ms`)
        parts.push(`- **Mean RT (error)**: ${fmt(simMeanErrorRT * 1000, 4)} ms`)
        parts.push('')

        // RT distribution summary
        if (rtDist.length > 0) {
          rtDist.sort((a, b) => a - b)
          parts.push('### RT Distribution (correct trials)')
          parts.push(`- **Median**: ${fmt(rtDist[Math.floor(rtDist.length * 0.5)] * 1000, 4)} ms`)
          parts.push(`- **10th percentile**: ${fmt(rtDist[Math.floor(rtDist.length * 0.1)] * 1000, 4)} ms`)
          parts.push(`- **90th percentile**: ${fmt(rtDist[Math.floor(rtDist.length * 0.9)] * 1000, 4)} ms`)
        }

      } else {
        return `Unknown model: "${model}". Supported: hicks, fitts, stevens, weber, sdt, ddm`
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 4. Biological Neural Network Simulation
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'neural_network_bio',
    description: 'Simulate biological neural networks. Supports Leaky Integrate-and-Fire (LIF) and FitzHugh-Nagumo (simplified Hodgkin-Huxley) models. Simulate networks of up to 50 neurons with excitatory/inhibitory synapses.',
    parameters: {
      neurons: { type: 'number', description: 'Number of neurons (default: 10, max 50)' },
      connections: { type: 'string', description: 'JSON array: [{from: 0, to: 1, weight: 0.5, type: "excitatory"}]' },
      stimulus: { type: 'string', description: 'JSON: {neuron: 0, current: 10, start_ms: 0, end_ms: 50}', required: true },
      duration_ms: { type: 'number', description: 'Simulation duration in ms (default: 100)' },
      model: { type: 'string', description: 'Neuron model: lif (default), hh (FitzHugh-Nagumo)' },
    },
    tier: 'free',
    async execute(args) {
      const nNeurons = Math.min(Math.max(Number(args.neurons) || 10, 1), 50)
      const duration = Math.min(Number(args.duration_ms) || 100, 1000)
      const modelType = String(args.model || 'lif').toLowerCase()

      interface Synapse {
        from: number
        to: number
        weight: number
        type: 'excitatory' | 'inhibitory'
        delay_ms: number
      }

      const synapses: Synapse[] = []
      if (args.connections) {
        const raw = safeJSON(String(args.connections)) as Array<Record<string, unknown>> | null
        if (raw && Array.isArray(raw)) {
          for (const c of raw) {
            synapses.push({
              from: Number(c.from || 0),
              to: Number(c.to || 0),
              weight: Number(c.weight || 0.5),
              type: String(c.type || 'excitatory') as 'excitatory' | 'inhibitory',
              delay_ms: Number(c.delay_ms || 1),
            })
          }
        }
      }

      interface Stimulus {
        neuron: number
        current: number
        start_ms: number
        end_ms: number
      }

      const stimRaw = safeJSON(String(args.stimulus)) as Record<string, unknown> | Array<Record<string, unknown>> | null
      const stimuli: Stimulus[] = []
      if (stimRaw) {
        const stimArr = Array.isArray(stimRaw) ? stimRaw : [stimRaw]
        for (const s of stimArr) {
          stimuli.push({
            neuron: Number(s.neuron || 0),
            current: Number(s.current || 10),
            start_ms: Number(s.start_ms || 0),
            end_ms: Number(s.end_ms || duration),
          })
        }
      }

      const dt = 0.05  // ms
      const steps = Math.floor(duration / dt)

      // Spike records
      const spikes: Array<{ neuron: number; time_ms: number }> = []
      const spikeCountByNeuron = new Array(nNeurons).fill(0)

      if (modelType === 'lif') {
        // Leaky Integrate-and-Fire model
        // dV/dt = -(V - V_rest) / tau + I / C
        const V_rest = -70     // mV
        const V_thresh = -55   // mV
        const V_reset = -75    // mV
        const tau = 10         // ms (membrane time constant)
        const C = 1            // nF (membrane capacitance)
        const refractoryPeriod = 2  // ms

        const V = new Array(nNeurons).fill(V_rest)
        const refractoryTimer = new Array(nNeurons).fill(0)
        const synapticInput = new Array(nNeurons).fill(0)

        // Delayed spike queue
        const spikeQueue: Array<{ target: number; weight: number; time: number }> = []

        // Record voltage trace for first few neurons
        const traceNeurons = Math.min(nNeurons, 5)
        const voltageTrace: number[][] = Array.from({ length: traceNeurons }, () => [])
        const traceInterval = Math.max(1, Math.floor(steps / 500))

        for (let step = 0; step < steps; step++) {
          const t = step * dt

          // Process delayed spikes arriving at this time
          for (let i = spikeQueue.length - 1; i >= 0; i--) {
            if (spikeQueue[i].time <= t) {
              synapticInput[spikeQueue[i].target] += spikeQueue[i].weight
              spikeQueue.splice(i, 1)
            }
          }

          for (let n = 0; n < nNeurons; n++) {
            if (refractoryTimer[n] > 0) {
              refractoryTimer[n] -= dt
              V[n] = V_reset
              continue
            }

            // External stimulus current
            let I_ext = 0
            for (const s of stimuli) {
              if (s.neuron === n && t >= s.start_ms && t <= s.end_ms) {
                I_ext += s.current
              }
            }

            // Synaptic input
            const I_syn = synapticInput[n]
            synapticInput[n] *= 0.9  // decay

            // Euler integration: dV/dt = -(V - V_rest) / tau + I / C
            const dV = (-(V[n] - V_rest) / tau + (I_ext + I_syn) / C) * dt
            V[n] += dV

            // Spike check
            if (V[n] >= V_thresh) {
              spikes.push({ neuron: n, time_ms: t })
              spikeCountByNeuron[n]++
              V[n] = V_reset
              refractoryTimer[n] = refractoryPeriod

              // Propagate to connected neurons
              for (const syn of synapses) {
                if (syn.from === n) {
                  const effectiveWeight = syn.type === 'inhibitory' ? -Math.abs(syn.weight) : Math.abs(syn.weight)
                  spikeQueue.push({
                    target: syn.to,
                    weight: effectiveWeight * 20,  // scale for mV impact
                    time: t + syn.delay_ms,
                  })
                }
              }
            }
          }

          // Record voltage trace
          if (step % traceInterval === 0) {
            for (let n = 0; n < traceNeurons; n++) {
              voltageTrace[n].push(V[n])
            }
          }
        }

        const parts: string[] = ['## Biological Neural Network Simulation (LIF Model)\n']
        parts.push(`**Neurons**: ${nNeurons} | **Synapses**: ${synapses.length} | **Duration**: ${duration} ms | **dt**: ${dt} ms`)
        parts.push(`**Parameters**: V_rest=${V_rest}mV, V_thresh=${V_thresh}mV, V_reset=${V_reset}mV, \u03C4=${tau}ms`)
        parts.push('')

        parts.push('### Spike Summary')
        parts.push(`**Total spikes**: ${spikes.length} | **Mean firing rate**: ${fmt(spikes.length / nNeurons / (duration / 1000), 3)} Hz/neuron`)
        parts.push('')
        parts.push('| Neuron | Spike Count | Firing Rate (Hz) |')
        parts.push('|---|---|---|')
        for (let n = 0; n < nNeurons; n++) {
          if (spikeCountByNeuron[n] > 0 || n < 10) {
            parts.push(`| ${n} | ${spikeCountByNeuron[n]} | ${fmt(spikeCountByNeuron[n] / (duration / 1000), 3)} |`)
          }
        }
        parts.push('')

        // Spike raster (text representation)
        if (spikes.length > 0) {
          parts.push('### Spike Raster (first 200 spikes)')
          const bins = 20
          const binWidth = duration / bins
          parts.push(`| Neuron | ${Array.from({ length: bins }, (_, i) => `${fmt(i * binWidth, 2)}`).join(' | ')} |`)
          parts.push(`|---|${Array.from({ length: bins }, () => '---').join(' | ')} |`)
          for (let n = 0; n < Math.min(nNeurons, 15); n++) {
            const nSpikes = spikes.filter(s => s.neuron === n)
            const row = Array.from({ length: bins }, (_, i) => {
              const count = nSpikes.filter(s => s.time_ms >= i * binWidth && s.time_ms < (i + 1) * binWidth).length
              return count > 0 ? '\u2588' : '\u00B7'
            })
            parts.push(`| ${n} | ${row.join(' | ')} |`)
          }
        }

        // Voltage trace ASCII
        if (voltageTrace[0].length > 0) {
          parts.push('')
          parts.push('### Voltage Trace (Neuron 0)')
          const trace = voltageTrace[0]
          const minV = Math.min(...trace)
          const maxV = Math.max(...trace)
          const range = maxV - minV || 1
          const height = 8
          for (let row = height - 1; row >= 0; row--) {
            const threshold = minV + (row / (height - 1)) * range
            let line = ''
            const step = Math.max(1, Math.floor(trace.length / 60))
            for (let i = 0; i < trace.length; i += step) {
              line += trace[i] >= threshold ? '\u2588' : ' '
            }
            const label = fmt(threshold, 3).padStart(8)
            parts.push(`${label} |${line}|`)
          }
        }

        return parts.join('\n')

      } else {
        // FitzHugh-Nagumo model (simplified Hodgkin-Huxley)
        // dv/dt = v - v^3/3 - w + I
        // dw/dt = (v + a - b*w) / tau
        const a_fhn = 0.7
        const b_fhn = 0.8
        const tau_fhn = 12.5
        const v_thresh = 1.0

        const v = new Array(nNeurons).fill(-1.2)  // membrane voltage-like variable
        const w = new Array(nNeurons).fill(-0.6)   // recovery variable
        const lastSpikeTime = new Array(nNeurons).fill(-100)

        const traceNeurons = Math.min(nNeurons, 5)
        const vTrace: number[][] = Array.from({ length: traceNeurons }, () => [])
        const wTrace: number[][] = Array.from({ length: traceNeurons }, () => [])
        const traceInterval = Math.max(1, Math.floor(steps / 500))

        for (let step = 0; step < steps; step++) {
          const t = step * dt

          for (let n = 0; n < nNeurons; n++) {
            let I_ext = 0
            for (const s of stimuli) {
              if (s.neuron === n && t >= s.start_ms && t <= s.end_ms) {
                I_ext += s.current
              }
            }

            // Synaptic input from spikes
            let I_syn = 0
            for (const syn of synapses) {
              if (syn.to === n) {
                // Check if the presynaptic neuron spiked recently
                const preSpikes = spikes.filter(s => s.neuron === syn.from && t - s.time_ms > 0 && t - s.time_ms < 5)
                for (const ps of preSpikes) {
                  const decayedWeight = syn.weight * Math.exp(-(t - ps.time_ms) / 3)
                  I_syn += syn.type === 'inhibitory' ? -decayedWeight : decayedWeight
                }
              }
            }

            const dv = (v[n] - v[n] * v[n] * v[n] / 3 - w[n] + I_ext + I_syn) * dt
            const dw = ((v[n] + a_fhn - b_fhn * w[n]) / tau_fhn) * dt

            v[n] += dv
            w[n] += dw

            // Detect spike (upward threshold crossing)
            if (v[n] >= v_thresh && (t - lastSpikeTime[n]) > 3) {
              spikes.push({ neuron: n, time_ms: t })
              spikeCountByNeuron[n]++
              lastSpikeTime[n] = t
            }
          }

          if (step % traceInterval === 0) {
            for (let n = 0; n < traceNeurons; n++) {
              vTrace[n].push(v[n])
              wTrace[n].push(w[n])
            }
          }
        }

        const parts: string[] = ['## Biological Neural Network Simulation (FitzHugh-Nagumo Model)\n']
        parts.push(`**Neurons**: ${nNeurons} | **Synapses**: ${synapses.length} | **Duration**: ${duration} ms | **dt**: ${dt} ms`)
        parts.push(`**Parameters**: a=${a_fhn}, b=${b_fhn}, \u03C4=${tau_fhn}`)
        parts.push('')

        parts.push('### Spike Summary')
        parts.push(`**Total spikes**: ${spikes.length} | **Mean rate**: ${fmt(spikes.length / nNeurons / (duration / 1000), 3)} Hz/neuron`)
        parts.push('')
        parts.push('| Neuron | Spike Count | Firing Rate (Hz) |')
        parts.push('|---|---|---|')
        for (let n = 0; n < nNeurons; n++) {
          if (spikeCountByNeuron[n] > 0 || n < 10) {
            parts.push(`| ${n} | ${spikeCountByNeuron[n]} | ${fmt(spikeCountByNeuron[n] / (duration / 1000), 3)} |`)
          }
        }

        if (vTrace[0].length > 0) {
          parts.push('')
          parts.push('### Phase Portrait Data (Neuron 0)')
          parts.push('| v (membrane) | w (recovery) |')
          parts.push('|---|---|')
          const step = Math.max(1, Math.floor(vTrace[0].length / 20))
          for (let i = 0; i < vTrace[0].length; i += step) {
            parts.push(`| ${fmt(vTrace[0][i], 4)} | ${fmt(wTrace[0][i], 4)} |`)
          }
        }

        return parts.join('\n')
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 5. Neurotransmitter Lookup
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'neurotransmitter_lookup',
    description: 'Encyclopedia of ~30 neurotransmitter systems. Search by name, function, or associated disorder. Returns type, receptors, functions, disorders, drugs, and synthesis pathway.',
    parameters: {
      query: { type: 'string', description: 'Neurotransmitter name, function, or disorder to search for', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).toLowerCase()

      const matches: Neurotransmitter[] = []

      for (const [key, nt] of Object.entries(NEUROTRANSMITTERS)) {
        const match = key.includes(query) ||
          nt.name.toLowerCase().includes(query) ||
          nt.type.toLowerCase().includes(query) ||
          nt.functions.some(f => f.toLowerCase().includes(query)) ||
          nt.disorders.some(d => d.toLowerCase().includes(query)) ||
          nt.drugs.some(d => d.toLowerCase().includes(query)) ||
          nt.receptors.some(r => r.toLowerCase().includes(query))
        if (match) matches.push(nt)
      }

      if (matches.length === 0) {
        return `No neurotransmitters found matching "${args.query}".\n\nAvailable: ${Object.values(NEUROTRANSMITTERS).map(n => n.name).join(', ')}`
      }

      const parts = [`## Neurotransmitter Lookup (${matches.length} matches for "${args.query}")\n`]

      for (const nt of matches) {
        parts.push(`### ${nt.name}`)
        parts.push(`- **Type**: ${nt.type}`)
        parts.push(`- **Receptors**: ${nt.receptors.join('; ')}`)
        parts.push(`- **Functions**: ${nt.functions.join(', ')}`)
        parts.push(`- **Associated Disorders**: ${nt.disorders.join(', ')}`)
        parts.push(`- **Key Drugs**: ${nt.drugs.join('; ')}`)
        parts.push(`- **Synthesis**: ${nt.synthesis}`)
        parts.push('')
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 6. Psychophysics Calculator
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'psychophysics_calc',
    description: 'Psychophysics calculations: JND, Weber fraction, staircase procedure analysis, psychometric function fitting (logistic/Weibull), threshold estimation.',
    parameters: {
      method: { type: 'string', description: 'Method: jnd, weber, staircase, psychometric_function', required: true },
      data: { type: 'string', description: 'JSON with method-specific data', required: true },
      params: { type: 'string', description: 'JSON with optional parameters (e.g., function type, step sizes)' },
    },
    tier: 'free',
    async execute(args) {
      const method = String(args.method).toLowerCase()
      const data = safeJSON(String(args.data)) as Record<string, unknown> | null
      const params = args.params ? safeJSON(String(args.params)) as Record<string, unknown> | null : null

      if (!data) return 'Error: data must be valid JSON.'

      const parts: string[] = []

      if (method === 'jnd') {
        // Just Noticeable Difference
        const standard = Number(data.standard || data.reference || 100)
        const weberFraction = Number(data.weber_fraction || data.k || 0.05)
        const nSteps = Number(data.steps || 10)

        const jnd = standard * weberFraction

        parts.push('## Just Noticeable Difference (JND)')
        parts.push(`**Standard stimulus**: ${standard}`)
        parts.push(`**Weber fraction (k)**: ${weberFraction}`)
        parts.push(`**JND (\u0394I)**: ${fmt(jnd, 6)}`)
        parts.push('')
        parts.push('### JND Steps')
        parts.push('| Step | Stimulus Value | Cumulative Change |')
        parts.push('|---|---|---|')
        let current = standard
        for (let i = 0; i <= nSteps; i++) {
          parts.push(`| ${i} | ${fmt(current, 6)} | ${i === 0 ? '0' : fmt(current - standard, 6)} |`)
          current += current * weberFraction
        }
        parts.push('')
        parts.push(`*After ${nSteps} JND steps: stimulus = ${fmt(current - current * weberFraction, 6)} (${fmt(((current - current * weberFraction) / standard - 1) * 100, 3)}% increase)*`)

      } else if (method === 'weber') {
        // Weber fraction from data
        const pairs = data.pairs as Array<{ standard: number; jnd: number }> | undefined
        if (!pairs || !Array.isArray(pairs)) {
          return 'Error: "pairs" must be an array of {standard, jnd} objects.'
        }

        parts.push('## Weber Fraction Analysis')
        parts.push('| Standard | JND | Weber Fraction |')
        parts.push('|---|---|---|')
        let sumK = 0
        for (const pair of pairs) {
          const k = pair.jnd / pair.standard
          sumK += k
          parts.push(`| ${pair.standard} | ${pair.jnd} | ${fmt(k, 6)} |`)
        }
        const meanK = sumK / pairs.length
        parts.push('')
        parts.push(`**Mean Weber fraction**: ${fmt(meanK, 6)}`)

        // Check if Weber's law holds (constant k)
        const fractions = pairs.map(p => p.jnd / p.standard)
        const sd = Math.sqrt(fractions.reduce((s, k) => s + (k - meanK) ** 2, 0) / fractions.length)
        const cv = sd / meanK
        parts.push(`**Standard deviation**: ${fmt(sd, 6)}`)
        parts.push(`**Coefficient of variation**: ${fmt(cv * 100, 3)}%`)
        parts.push(`**Weber's law holds**: ${cv < 0.2 ? 'Yes (CV < 20%)' : 'Questionable (CV >= 20%)'}`)

      } else if (method === 'staircase') {
        // Staircase procedure analysis
        const trials = data.trials as Array<{ level: number; correct: boolean }> | undefined
        if (!trials || !Array.isArray(trials)) {
          return 'Error: "trials" must be an array of {level, correct} objects.'
        }

        const stepUp = Number(params?.step_up || params?.step_down || 1)
        const stepDown = Number(params?.step_down || params?.step_up || 1)
        const targetProp = Number(params?.target || 0.707)  // 1-down/1-up converges to 50%, 2-down/1-up to 70.7%

        // Find reversals
        const reversals: number[] = []
        let lastDirection: 'up' | 'down' | null = null
        for (let i = 1; i < trials.length; i++) {
          const direction: 'up' | 'down' | null = trials[i].level > trials[i - 1].level ? 'up' : trials[i].level < trials[i - 1].level ? 'down' : lastDirection
          if (direction && lastDirection && direction !== lastDirection) {
            reversals.push(trials[i].level)
          }
          if (direction) lastDirection = direction
        }

        // Threshold estimate: mean of last N reversals
        const nReversals = Math.min(reversals.length, 6)
        const thresholdReversals = reversals.slice(-nReversals)
        const threshold = thresholdReversals.length > 0
          ? thresholdReversals.reduce((a, b) => a + b, 0) / thresholdReversals.length
          : NaN

        parts.push('## Staircase Procedure Analysis')
        parts.push(`**Trials**: ${trials.length} | **Reversals**: ${reversals.length}`)
        parts.push(`**Step up**: ${stepUp} | **Step down**: ${stepDown}`)
        parts.push(`**Target performance**: ${fmt(targetProp * 100, 3)}%`)
        parts.push('')
        parts.push(`### Threshold Estimate`)
        parts.push(`**Threshold** (mean of last ${nReversals} reversals): **${isNaN(threshold) ? 'N/A' : fmt(threshold, 4)}**`)
        parts.push('')

        if (reversals.length > 0) {
          parts.push('### Reversal Points')
          parts.push('| Reversal # | Level |')
          parts.push('|---|---|')
          for (let i = 0; i < reversals.length; i++) {
            parts.push(`| ${i + 1} | ${fmt(reversals[i], 4)} |`)
          }
        }

        // Performance summary
        const correctCount = trials.filter(t => t.correct).length
        parts.push('')
        parts.push(`### Performance: ${correctCount}/${trials.length} correct (${fmt(correctCount / trials.length * 100, 3)}%)`)

      } else if (method === 'psychometric_function' || method === 'psychometric') {
        // Psychometric function fitting
        const points = data.points as Array<{ level: number; n_correct: number; n_total: number }> | undefined
        if (!points || !Array.isArray(points)) {
          return 'Error: "points" must be an array of {level, n_correct, n_total} objects.'
        }

        const funcType = String(params?.function || 'logistic').toLowerCase()
        const guessRate = Number(params?.guess_rate || 0.5)  // for 2AFC
        const lapseRate = Number(params?.lapse_rate || 0.02)

        // Fit psychometric function via grid search
        // Logistic: p = guess + (1-guess-lapse) * 1/(1+exp(-slope*(x-threshold)))
        // Weibull: p = guess + (1-guess-lapse) * (1-exp(-(x/threshold)^slope))

        let bestThresh = 0
        let bestSlope = 1
        let bestLL = -Infinity

        const levels = points.map(p => p.level)
        const minLevel = Math.min(...levels)
        const maxLevel = Math.max(...levels)
        const range = maxLevel - minLevel || 1

        for (let ti = 0; ti <= 50; ti++) {
          const thresh = minLevel + (ti / 50) * range
          for (let si = 1; si <= 40; si++) {
            const slope = si * 0.5

            let ll = 0
            for (const pt of points) {
              let p: number
              if (funcType === 'weibull') {
                p = guessRate + (1 - guessRate - lapseRate) * (1 - Math.exp(-Math.pow(Math.max(pt.level, 0.001) / Math.max(thresh, 0.001), slope)))
              } else {
                p = guessRate + (1 - guessRate - lapseRate) / (1 + Math.exp(-slope * (pt.level - thresh)))
              }
              p = Math.max(0.001, Math.min(0.999, p))
              ll += pt.n_correct * Math.log(p) + (pt.n_total - pt.n_correct) * Math.log(1 - p)
            }

            if (ll > bestLL) {
              bestLL = ll
              bestThresh = thresh
              bestSlope = slope
            }
          }
        }

        parts.push(`## Psychometric Function Fitting (${funcType})`)
        parts.push('')
        parts.push('### Fitted Parameters')
        parts.push(`- **Threshold (\u03B1)**: ${fmt(bestThresh, 4)}`)
        parts.push(`- **Slope (\u03B2)**: ${fmt(bestSlope, 4)}`)
        parts.push(`- **Guess rate (\u03B3)**: ${guessRate}`)
        parts.push(`- **Lapse rate (\u03BB)**: ${lapseRate}`)
        parts.push(`- **Log-likelihood**: ${fmt(bestLL, 4)}`)
        parts.push('')

        parts.push('### Observed vs. Predicted')
        parts.push('| Level | Observed P(correct) | Predicted P(correct) | n |')
        parts.push('|---|---|---|---|')
        for (const pt of points) {
          const observed = pt.n_correct / pt.n_total
          let predicted: number
          if (funcType === 'weibull') {
            predicted = guessRate + (1 - guessRate - lapseRate) * (1 - Math.exp(-Math.pow(Math.max(pt.level, 0.001) / Math.max(bestThresh, 0.001), bestSlope)))
          } else {
            predicted = guessRate + (1 - guessRate - lapseRate) / (1 + Math.exp(-bestSlope * (pt.level - bestThresh)))
          }
          parts.push(`| ${fmt(pt.level, 4)} | ${fmt(observed, 4)} | ${fmt(predicted, 4)} | ${pt.n_total} |`)
        }

        // Key thresholds
        parts.push('')
        parts.push('### Key Thresholds')
        for (const targetP of [0.50, 0.75, 0.82, 0.90]) {
          // Inverse of psychometric function
          const p_adj = (targetP - guessRate) / (1 - guessRate - lapseRate)
          let level: number
          if (funcType === 'weibull') {
            level = bestThresh * Math.pow(-Math.log(1 - Math.min(p_adj, 0.999)), 1 / bestSlope)
          } else {
            level = bestThresh - Math.log((1 / Math.min(p_adj, 0.999)) - 1) / bestSlope
          }
          parts.push(`- **${fmt(targetP * 100, 3)}% correct**: level = ${fmt(level, 4)}`)
        }

      } else {
        return `Unknown method: "${method}". Supported: jnd, weber, staircase, psychometric_function`
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 7. Connectome Query
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'connectome_query',
    description: 'Query brain connectivity patterns using a simplified structural connectome of 20 major brain regions. Find paths between regions, identify network hubs, compute graph metrics.',
    parameters: {
      from_region: { type: 'string', description: 'Source region name or abbreviation' },
      to_region: { type: 'string', description: 'Target region name or abbreviation' },
      query_type: { type: 'string', description: 'Query: path (shortest path), hubs (identify hubs), connectivity (show connections), all (default: all)' },
    },
    tier: 'free',
    async execute(args) {
      const queryType = String(args.query_type || 'all').toLowerCase()
      const N = CONNECTOME_REGIONS.length

      function findRegion(query?: string): number {
        if (!query) return -1
        const q = String(query).toLowerCase()
        for (let i = 0; i < N; i++) {
          if (CONNECTOME_REGIONS[i].name.toLowerCase().includes(q) ||
              CONNECTOME_REGIONS[i].abbreviation.toLowerCase() === q) {
            return i
          }
        }
        return -1
      }

      const fromIdx = findRegion(args.from_region as string | undefined)
      const toIdx = findRegion(args.to_region as string | undefined)

      const parts: string[] = ['## Brain Connectome Analysis\n']

      // Compute graph metrics
      // Node degree (weighted)
      const degrees: number[] = []
      const strengths: number[] = []
      for (let i = 0; i < N; i++) {
        let deg = 0, str = 0
        for (let j = 0; j < N; j++) {
          if (CONNECTIVITY[i][j] > 0.1) { deg++; str += CONNECTIVITY[i][j] }
        }
        degrees.push(deg)
        strengths.push(str)
      }

      // Betweenness centrality (simplified: count shortest paths through each node)
      // Using Floyd-Warshall for all-pairs shortest paths
      const dist: number[][] = Array.from({ length: N }, () => new Array(N).fill(Infinity))
      const next: number[][] = Array.from({ length: N }, () => new Array(N).fill(-1))
      for (let i = 0; i < N; i++) {
        dist[i][i] = 0
        for (let j = 0; j < N; j++) {
          if (CONNECTIVITY[i][j] > 0.1) {
            dist[i][j] = 1 / CONNECTIVITY[i][j]  // inverse weight = distance
            next[i][j] = j
          }
        }
      }
      for (let k = 0; k < N; k++) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            if (dist[i][k] + dist[k][j] < dist[i][j]) {
              dist[i][j] = dist[i][k] + dist[k][j]
              next[i][j] = next[i][k]
            }
          }
        }
      }

      // Reconstruct path
      function getPath(from: number, to: number): number[] {
        if (next[from][to] === -1) return []
        const path = [from]
        let cur = from
        while (cur !== to) {
          cur = next[cur][to]
          if (cur === -1) return []
          path.push(cur)
        }
        return path
      }

      // Clustering coefficient
      function clusteringCoeff(node: number): number {
        const neighbors: number[] = []
        for (let j = 0; j < N; j++) {
          if (j !== node && CONNECTIVITY[node][j] > 0.1) neighbors.push(j)
        }
        if (neighbors.length < 2) return 0
        let triangles = 0
        for (let i = 0; i < neighbors.length; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            if (CONNECTIVITY[neighbors[i]][neighbors[j]] > 0.1) triangles++
          }
        }
        return (2 * triangles) / (neighbors.length * (neighbors.length - 1))
      }

      if (queryType === 'path' || queryType === 'all') {
        if (fromIdx >= 0 && toIdx >= 0) {
          const path = getPath(fromIdx, toIdx)
          parts.push('### Shortest Path')
          if (path.length > 0) {
            parts.push(`**From**: ${CONNECTOME_REGIONS[fromIdx].name} (${CONNECTOME_REGIONS[fromIdx].abbreviation})`)
            parts.push(`**To**: ${CONNECTOME_REGIONS[toIdx].name} (${CONNECTOME_REGIONS[toIdx].abbreviation})`)
            parts.push(`**Path length**: ${path.length - 1} hops | **Distance**: ${fmt(dist[fromIdx][toIdx], 4)}`)
            parts.push('')
            parts.push('**Route**:')
            for (let i = 0; i < path.length; i++) {
              const r = CONNECTOME_REGIONS[path[i]]
              const arrow = i < path.length - 1 ? ` \u2192 (w=${fmt(CONNECTIVITY[path[i]][path[i + 1]], 2)})` : ''
              parts.push(`${i + 1}. **${r.name}** (${r.abbreviation})${arrow}`)
            }
          } else {
            parts.push(`No path found between ${CONNECTOME_REGIONS[fromIdx].name} and ${CONNECTOME_REGIONS[toIdx].name}`)
          }
          parts.push('')
        }
      }

      if (queryType === 'connectivity' || queryType === 'all') {
        const targetIdx = fromIdx >= 0 ? fromIdx : toIdx >= 0 ? toIdx : -1
        if (targetIdx >= 0) {
          const r = CONNECTOME_REGIONS[targetIdx]
          parts.push(`### Connectivity of ${r.name} (${r.abbreviation})`)
          const connections: Array<{ region: string; abbr: string; weight: number }> = []
          for (let j = 0; j < N; j++) {
            if (j !== targetIdx && CONNECTIVITY[targetIdx][j] > 0.1) {
              connections.push({ region: CONNECTOME_REGIONS[j].name, abbr: CONNECTOME_REGIONS[j].abbreviation, weight: CONNECTIVITY[targetIdx][j] })
            }
          }
          connections.sort((a, b) => b.weight - a.weight)
          parts.push(`**Degree**: ${degrees[targetIdx]} | **Strength**: ${fmt(strengths[targetIdx], 4)} | **Clustering**: ${fmt(clusteringCoeff(targetIdx), 4)}`)
          parts.push('')
          parts.push('| Connected Region | Weight | Strength |')
          parts.push('|---|---|---|')
          for (const c of connections) {
            const bar = '\u2588'.repeat(Math.round(c.weight * 10))
            parts.push(`| ${c.region} (${c.abbr}) | ${fmt(c.weight, 2)} | ${bar} |`)
          }
          parts.push('')
        }
      }

      if (queryType === 'hubs' || queryType === 'all') {
        parts.push('### Network Hubs (ranked by strength)')
        const ranked = CONNECTOME_REGIONS.map((r, i) => ({
          name: r.name,
          abbr: r.abbreviation,
          lobe: r.lobe,
          degree: degrees[i],
          strength: strengths[i],
          clustering: clusteringCoeff(i),
        })).sort((a, b) => b.strength - a.strength)

        parts.push('| Rank | Region | Lobe | Degree | Strength | Clustering |')
        parts.push('|---|---|---|---|---|---|')
        for (let i = 0; i < ranked.length; i++) {
          const r = ranked[i]
          parts.push(`| ${i + 1} | ${r.name} (${r.abbr}) | ${r.lobe} | ${r.degree} | ${fmt(r.strength, 3)} | ${fmt(r.clustering, 3)} |`)
        }
        parts.push('')

        // Global metrics
        const avgDeg = degrees.reduce((a, b) => a + b, 0) / N
        const avgStr = strengths.reduce((a, b) => a + b, 0) / N
        const avgClust = CONNECTOME_REGIONS.reduce((sum, _, i) => sum + clusteringCoeff(i), 0) / N

        // Characteristic path length
        let totalDist = 0, pathCount = 0
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            if (isFinite(dist[i][j])) { totalDist += dist[i][j]; pathCount++ }
          }
        }

        parts.push('### Global Network Metrics')
        parts.push(`- **Avg degree**: ${fmt(avgDeg, 3)}`)
        parts.push(`- **Avg strength**: ${fmt(avgStr, 3)}`)
        parts.push(`- **Avg clustering coefficient**: ${fmt(avgClust, 3)}`)
        parts.push(`- **Characteristic path length**: ${fmt(pathCount > 0 ? totalDist / pathCount : 0, 3)}`)
        parts.push(`- **Network density**: ${fmt(degrees.reduce((a, b) => a + b, 0) / (N * (N - 1)), 3)}`)
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 8. Cognitive Task Design
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'cognitive_task_design',
    description: 'Generate protocols for standard cognitive/neuroscience experimental tasks: Stroop, N-back, Go/No-Go, Wisconsin Card Sort, Iowa Gambling Task, Flanker, Visual Search, Change Detection.',
    parameters: {
      task: { type: 'string', description: 'Task: stroop, nback, gonogo, wcst, igt, flanker, visual_search, change_detection', required: true },
      n_trials: { type: 'number', description: 'Number of trials (default: 100)' },
      difficulty: { type: 'string', description: 'Difficulty: easy, medium, hard (default: medium)' },
    },
    tier: 'free',
    async execute(args) {
      const task = String(args.task).toLowerCase().replace(/[- ]/g, '_')
      const nTrials = Math.min(Number(args.n_trials) || 100, 500)
      const difficulty = String(args.difficulty || 'medium').toLowerCase()

      const parts: string[] = []

      if (task === 'stroop') {
        const colors = ['RED', 'BLUE', 'GREEN', 'YELLOW']
        const congruentPct = difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 0.25 : 0.50
        const nCongruent = Math.round(nTrials * congruentPct)

        parts.push('## Stroop Task Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants name the **ink color** of color words, ignoring the word meaning.')
        parts.push('Measures selective attention, inhibition, and cognitive control.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push(`- **Congruent trials**: ${nCongruent} (${fmt(congruentPct * 100, 3)}%)`)
        parts.push(`- **Incongruent trials**: ${nTrials - nCongruent} (${fmt((1 - congruentPct) * 100, 3)}%)`)
        parts.push(`- **Difficulty**: ${difficulty}`)
        parts.push(`- **Colors**: ${colors.join(', ')}`)
        parts.push('')
        parts.push('### Timing')
        parts.push('- **Fixation**: 500 ms')
        parts.push('- **Stimulus duration**: Until response (max 2000 ms)')
        parts.push('- **Inter-trial interval**: 1000-1500 ms (jittered)')
        parts.push('- **Response window**: 200-2000 ms')
        parts.push('')
        parts.push('### Trial Structure')
        parts.push('1. Fixation cross (+) — 500 ms')
        parts.push('2. Color word in colored ink — until response')
        parts.push('3. Feedback (optional) — 300 ms')
        parts.push('4. ITI — 1000-1500 ms')
        parts.push('')
        parts.push('### Expected Effects')
        parts.push('- **Stroop effect**: ~100-200 ms slower for incongruent vs congruent')
        parts.push('- **Error rate**: ~5-10% incongruent, ~1-2% congruent')
        parts.push('- **Congruency sequence effect**: Reduced Stroop after incongruent trial')
        parts.push('')
        parts.push('### Counterbalancing')
        parts.push('- Equal frequency of each color as ink and word')
        parts.push('- No more than 3 consecutive same-type trials')
        parts.push('- Pseudorandomized order with constraints')
        parts.push('')
        parts.push('### Sample Trials (first 10)')
        parts.push('| Trial | Word | Ink Color | Condition | Correct Response |')
        parts.push('|---|---|---|---|---|')
        for (let i = 0; i < Math.min(10, nTrials); i++) {
          const isCongruent = i < nCongruent
          const inkColor = colors[i % colors.length]
          const word = isCongruent ? inkColor : colors[(i + 1 + Math.floor(i / 2)) % colors.length]
          parts.push(`| ${i + 1} | ${word} | ${inkColor} | ${isCongruent ? 'Congruent' : 'Incongruent'} | ${inkColor} |`)
        }

      } else if (task === 'nback' || task === 'n_back') {
        const n = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2
        const targetPct = 0.30

        parts.push(`## ${n}-Back Task Protocol`)
        parts.push('')
        parts.push('### Task Description')
        parts.push(`Participants indicate when the current stimulus matches the one ${n} positions back.`)
        parts.push('Measures working memory updating, monitoring, and executive function.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **N**: ${n} (${n}-back)`)
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push(`- **Target trials**: ~${Math.round(nTrials * targetPct)} (${fmt(targetPct * 100, 3)}%)`)
        parts.push(`- **Lure trials**: ~${Math.round(nTrials * 0.15)} (15%, ${n > 1 ? `${n - 1}-back or ${n + 1}-back matches` : 'similar stimuli'})`)
        parts.push(`- **Stimulus set**: Letters (A-J, excluding similar pairs)`)
        parts.push('')
        parts.push('### Timing')
        parts.push('- **Stimulus duration**: 500 ms')
        parts.push('- **Inter-stimulus interval**: 2000 ms')
        parts.push('- **Response window**: 500-2500 ms from stimulus onset')
        parts.push('- **Total block time**: ~' + fmt(nTrials * 2.5 / 60, 2) + ' min')
        parts.push('')
        parts.push('### Trial Structure')
        parts.push('1. Letter appears on screen — 500 ms')
        parts.push('2. Blank (response continues) — 2000 ms')
        parts.push(`3. Target: press if matches ${n}-back letter`)
        parts.push('4. Non-target: withhold response')
        parts.push('')
        parts.push('### Expected Performance')
        parts.push(`| N-back Level | Hit Rate | FA Rate | d' | Typical RT |`)
        parts.push('|---|---|---|---|---|')
        parts.push('| 1-back | 90-95% | 3-8% | 3.0-4.0 | ~500 ms |')
        parts.push('| 2-back | 75-85% | 5-15% | 2.0-3.0 | ~550 ms |')
        parts.push('| 3-back | 55-70% | 10-25% | 1.0-2.0 | ~600 ms |')
        parts.push('')
        parts.push('### Counterbalancing')
        parts.push('- Equal frequency of all letters')
        parts.push('- Targets evenly distributed across blocks')
        parts.push(`- Lures specifically ${n - 1 > 0 ? `${n - 1}-back and ` : ''}${n + 1}-back matches to test interference`)
        parts.push('- No consecutive targets')

      } else if (task === 'gonogo' || task === 'go_no_go') {
        const goPct = difficulty === 'easy' ? 0.80 : difficulty === 'hard' ? 0.50 : 0.70
        const nGo = Math.round(nTrials * goPct)

        parts.push('## Go/No-Go Task Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants respond to frequent "Go" stimuli and withhold response to rare "No-Go" stimuli.')
        parts.push('Measures response inhibition and sustained attention.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push(`- **Go trials**: ${nGo} (${fmt(goPct * 100, 3)}%)`)
        parts.push(`- **No-Go trials**: ${nTrials - nGo} (${fmt((1 - goPct) * 100, 3)}%)`)
        parts.push(`- **Difficulty**: ${difficulty}`)
        parts.push('')
        parts.push('### Timing')
        parts.push('- **Fixation**: 500 ms')
        parts.push('- **Stimulus**: 250 ms')
        parts.push('- **Response window**: 250-1000 ms post-stimulus')
        parts.push('- **ITI**: 1200-1800 ms (jittered)')
        parts.push('- **Total time**: ~' + fmt(nTrials * 2.25 / 60, 2) + ' min')
        parts.push('')
        parts.push('### Expected Effects')
        parts.push('- **Commission errors (false alarms)**: 15-30% on No-Go trials')
        parts.push('- **Omission errors**: 2-5% on Go trials')
        parts.push('- **Go RT**: ~350-450 ms')
        parts.push('- **Speed-accuracy tradeoff**: Faster Go RT = more commission errors')
        parts.push('- **Prepotent response**: High Go ratio builds response tendency, making inhibition harder')
        parts.push('')
        parts.push('### ERP Components')
        parts.push('- **N2**: ~200-350 ms, larger for No-Go (conflict monitoring)')
        parts.push('- **P3**: ~300-500 ms, No-Go P3 > Go P3 (inhibition index)')

      } else if (task === 'wcst' || task === 'wisconsin') {
        const categoriesBeforeShift = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 6 : 8

        parts.push('## Wisconsin Card Sorting Task (WCST) Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants sort cards by an unknown rule (color, shape, number). After consecutive correct sorts, the rule changes without notice.')
        parts.push('Measures set-shifting, cognitive flexibility, and perseveration.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Cards**: 128 (2 decks of 64) or until ${nTrials} trials`)
        parts.push(`- **Categories**: Color, Shape, Number`)
        parts.push(`- **Correct before shift**: ${categoriesBeforeShift} consecutive`)
        parts.push(`- **Max categories**: 6 (2 full cycles of Color-Shape-Number)`)
        parts.push('')
        parts.push('### Card Properties')
        parts.push('- **Colors**: Red, Blue, Green, Yellow')
        parts.push('- **Shapes**: Triangle, Star, Cross, Circle')
        parts.push('- **Numbers**: 1, 2, 3, 4')
        parts.push('')
        parts.push('### Scoring Metrics')
        parts.push('| Metric | Description | Normal Range |')
        parts.push('|---|---|---|')
        parts.push('| Categories completed | Number of rule shifts achieved | 5-6 |')
        parts.push('| Total errors | All incorrect sorts | 10-25 |')
        parts.push('| Perseverative errors | Errors following previous rule | 5-15 |')
        parts.push('| Non-perseverative errors | Random/other errors | 5-10 |')
        parts.push('| Trials to first category | Learning speed | 10-15 |')
        parts.push('| Failure to maintain set | Errors after 5+ correct | 0-2 |')
        parts.push('')
        parts.push('### Rule Sequence')
        parts.push('1. **Color** (sort by card color)')
        parts.push(`2. After ${categoriesBeforeShift} correct → **Shape** (shift, no notification)`)
        parts.push(`3. After ${categoriesBeforeShift} correct → **Number** (shift)`)
        parts.push('4. Cycle repeats: Color → Shape → Number')

      } else if (task === 'igt' || task === 'iowa') {
        parts.push('## Iowa Gambling Task (IGT) Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants choose cards from 4 decks, learning which decks are advantageous vs. disadvantageous through trial and error.')
        parts.push('Measures decision making under ambiguity, somatic markers, and emotional learning.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push('- **Starting money**: $2000')
        parts.push('- **Decks**: A, B, C, D')
        parts.push('')
        parts.push('### Deck Structure')
        parts.push('| Deck | Reward/Card | Penalty Freq | Avg Penalty | Net/10 cards | Type |')
        parts.push('|---|---|---|---|---|---|')
        parts.push('| A | $100 | 5/10 | $250 | -$250 | Disadvantageous (high freq loss) |')
        parts.push('| B | $100 | 1/10 | $1250 | -$250 | Disadvantageous (low freq, high loss) |')
        parts.push('| C | $50 | 5/10 | $50 | +$250 | Advantageous (high freq, small loss) |')
        parts.push('| D | $50 | 1/10 | $250 | +$250 | Advantageous (low freq, moderate loss) |')
        parts.push('')
        parts.push('### Block Structure (5 blocks of 20 trials)')
        parts.push('| Block | Trials | Expected Behavior |')
        parts.push('|---|---|---|')
        parts.push('| 1 | 1-20 | Exploration, sampling all decks |')
        parts.push('| 2 | 21-40 | Begin developing preferences |')
        parts.push('| 3 | 41-60 | "Hunch" period — gut feeling about bad decks |')
        parts.push('| 4 | 61-80 | Conceptual understanding emerging |')
        parts.push('| 5 | 81-100 | Stable preference for C/D |')
        parts.push('')
        parts.push('### Key Metrics')
        parts.push('- **Net score**: (C+D) - (A+B) selections per block')
        parts.push('- **Learning curve**: Net score should increase across blocks')
        parts.push('- **Anticipatory SCR**: Skin conductance before choosing bad decks (somatic marker)')
        parts.push('')
        parts.push('### Clinical Significance')
        parts.push('- **VMPFC lesions**: Choose disadvantageously throughout (Bechara et al., 1994)')
        parts.push('- **Addiction**: Prefer high-reward decks despite long-term loss')
        parts.push('- **Psychopathy**: Reduced anticipatory SCR to risky choices')

      } else if (task === 'flanker') {
        const setSizeIncompatible = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 6 : 4

        parts.push('## Eriksen Flanker Task Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants respond to a central target while ignoring surrounding flanker stimuli.')
        parts.push('Measures selective attention and interference control.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push(`- **Congruent trials**: ${Math.round(nTrials / 2)} (50%)`)
        parts.push(`- **Incongruent trials**: ${Math.round(nTrials / 2)} (50%)`)
        parts.push(`- **Flankers per side**: ${setSizeIncompatible / 2}`)
        parts.push('')
        parts.push('### Stimuli')
        parts.push('- **Congruent**: > > > > > (or < < < < <)')
        parts.push('- **Incongruent**: > > < > > (or < < > < <)')
        parts.push('- **Response**: Left hand for <, Right hand for >')
        parts.push('')
        parts.push('### Timing')
        parts.push('- **Fixation**: 400-600 ms (jittered)')
        parts.push('- **Stimulus**: Until response (max 1500 ms)')
        parts.push('- **Response window**: 200-1500 ms')
        parts.push('- **ITI**: 1000-1500 ms')
        parts.push('')
        parts.push('### Expected Effects')
        parts.push('- **Flanker effect**: ~50-100 ms slower for incongruent')
        parts.push('- **Error rate**: ~5-15% incongruent, ~1-3% congruent')
        parts.push('- **Gratton effect**: Reduced flanker effect after incongruent trials')
        parts.push('- **Speed-accuracy tradeoff**: Faster responses = larger flanker effect')
        parts.push('')
        parts.push('### ERP Components')
        parts.push('- **N2**: ~200-350 ms (conflict detection, ACC source)')
        parts.push('- **ERN**: Error-related negativity post-error (~50-100 ms)')
        parts.push('- **LRP**: Lateralized readiness potential (incorrect response activation on incongruent)')

      } else if (task === 'visual_search') {
        const setSize = difficulty === 'easy' ? [4, 8] : difficulty === 'hard' ? [8, 16, 32] : [4, 8, 16]
        const targetPresent = 0.50

        parts.push('## Visual Search Task Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants search for a target among distractors. Set size varies to measure search efficiency.')
        parts.push('Measures attentional selection, feature integration, and search strategies.')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push(`- **Set sizes**: ${setSize.join(', ')} items`)
        parts.push(`- **Target present**: ${fmt(targetPresent * 100, 3)}% of trials`)
        parts.push(`- **Target**: Red T among Green T/Red L distractors`)
        parts.push('')
        parts.push('### Timing')
        parts.push('- **Fixation**: 500-800 ms')
        parts.push('- **Search display**: Until response (max 5000 ms)')
        parts.push('- **ITI**: 1000 ms')
        parts.push('')
        parts.push('### Conditions')
        parts.push('| Condition | Target | Distractors | Search Type |')
        parts.push('|---|---|---|---|')
        parts.push('| Feature (pop-out) | Red circle | Green circles | Parallel (~0 ms/item) |')
        parts.push('| Conjunction | Red T | Red L + Green T | Serial (~20-40 ms/item) |')
        parts.push('| Spatial configuration | T | Rotated L | Serial (~40-60 ms/item) |')
        parts.push('')
        parts.push('### Expected Effects')
        parts.push('- **Search slope (target present)**: 0 ms/item (pop-out) to 20-60 ms/item (serial)')
        parts.push('- **Search slope (target absent)**: ~2x target-present slope')
        parts.push('- **2:1 slope ratio**: Consistent with self-terminating serial search')
        parts.push('- **Set size effect**: Linear RT increase for serial, flat for parallel')

      } else if (task === 'change_detection') {
        const setSizes = difficulty === 'easy' ? [2, 3, 4] : difficulty === 'hard' ? [4, 6, 8] : [3, 4, 6]

        parts.push('## Change Detection Task Protocol')
        parts.push('')
        parts.push('### Task Description')
        parts.push('Participants view a brief display of colored squares, then after a delay, indicate whether a change occurred.')
        parts.push('Measures visual working memory capacity (Luck & Vogel, 1997).')
        parts.push('')
        parts.push('### Parameters')
        parts.push(`- **Total trials**: ${nTrials}`)
        parts.push(`- **Set sizes**: ${setSizes.join(', ')} items`)
        parts.push(`- **Change trials**: 50%`)
        parts.push(`- **Colors**: Red, Blue, Green, Yellow, Purple, White, Black, Cyan`)
        parts.push('')
        parts.push('### Timing')
        parts.push('- **Fixation**: 500 ms')
        parts.push('- **Memory array**: 100 ms')
        parts.push('- **Retention interval**: 900 ms')
        parts.push('- **Test array**: Until response (max 3000 ms)')
        parts.push('- **ITI**: 1000 ms')
        parts.push('')
        parts.push('### Trial Structure')
        parts.push('1. Fixation (+) — 500 ms')
        parts.push('2. Memory array (N colored squares) — 100 ms')
        parts.push('3. Blank (retention interval) — 900 ms')
        parts.push('4. Test array (same or one changed) — until response')
        parts.push('')
        parts.push("### Capacity Estimation (Cowan's K)")
        parts.push('K = S * (H - F), where S = set size, H = hit rate, F = false alarm rate')
        parts.push('')
        parts.push('### Expected Results')
        parts.push('| Set Size | Expected Hit Rate | Expected FA Rate | Expected K |')
        parts.push('|---|---|---|---|')
        for (const s of setSizes) {
          const k = Math.min(s, 3.5)
          const hr = Math.min(0.95, k / s + 0.5 * (1 - k / s))
          const far = Math.max(0.05, 1 - hr)
          parts.push(`| ${s} | ${fmt(hr * 100, 3)}% | ${fmt(far * 100, 3)}% | ${fmt(s * (hr - far), 3)} |`)
        }
        parts.push('')
        parts.push('### Typical Capacity')
        parts.push('- **K = 3-4 items** for healthy adults (Luck & Vogel, 1997)')
        parts.push('- **K = 1-2 items** in schizophrenia')
        parts.push('- K predicts fluid intelligence (r ~ 0.5)')

      } else {
        return `Unknown task: "${task}". Supported: stroop, nback, gonogo, wcst, igt, flanker, visual_search, change_detection`
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 9. Neuroimaging Coordinates
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'neuroimaging_coords',
    description: 'Convert between brain coordinate systems (MNI, Talairach), look up brain regions from coordinates, or find coordinates for named regions. Includes ~50 standard MNI atlas entries.',
    parameters: {
      coordinates: { type: 'string', description: 'JSON: {x, y, z} in mm' },
      from_space: { type: 'string', description: 'Coordinate space: mni or talairach (default: mni)' },
      operation: { type: 'string', description: 'Operation: convert, lookup, find_region (default: lookup)' },
    },
    tier: 'free',
    async execute(args) {
      const operation = String(args.operation || 'lookup').toLowerCase()
      const fromSpace = String(args.from_space || 'mni').toLowerCase()

      const parts: string[] = ['## Neuroimaging Coordinate Analysis\n']

      // MNI <-> Talairach conversion (Lancaster et al., 2007 - icbm2tal)
      function mniToTal(x: number, y: number, z: number): { x: number; y: number; z: number } {
        // Simplified icbm2tal transform
        return {
          x: Math.round(0.9357 * x + 0.0029 * y - 0.0072 * z - 1.0423),
          y: Math.round(-0.0065 * x + 0.9396 * y - 0.0726 * z - 1.3940),
          z: Math.round(0.0103 * x + 0.0752 * y + 0.8967 * z + 3.6475),
        }
      }

      function talToMni(x: number, y: number, z: number): { x: number; y: number; z: number } {
        // Approximate inverse
        return {
          x: Math.round(1.0667 * x - 0.0034 * y + 0.0087 * z + 1.1158),
          y: Math.round(0.0076 * x + 1.0637 * y + 0.0857 * z + 1.4862),
          z: Math.round(-0.0127 * x - 0.0895 * y + 1.1142 * z - 4.3377),
        }
      }

      if (args.coordinates) {
        const coords = safeJSON(String(args.coordinates)) as { x: number; y: number; z: number } | null
        if (!coords || typeof coords.x !== 'number') {
          return 'Error: coordinates must be JSON {x, y, z} in mm.'
        }

        const { x, y, z } = coords

        if (operation === 'convert') {
          parts.push('### Coordinate Conversion')
          if (fromSpace === 'mni') {
            const tal = mniToTal(x, y, z)
            parts.push(`**MNI**: (${x}, ${y}, ${z})`)
            parts.push(`**Talairach**: (${tal.x}, ${tal.y}, ${tal.z})`)
            parts.push('')
            parts.push('*Conversion via icbm2tal transform (Lancaster et al., 2007)*')
          } else {
            const mni = talToMni(x, y, z)
            parts.push(`**Talairach**: (${x}, ${y}, ${z})`)
            parts.push(`**MNI**: (${mni.x}, ${mni.y}, ${mni.z})`)
            parts.push('')
            parts.push('*Conversion via approximate inverse icbm2tal transform*')
          }
          parts.push('')
        }

        // Look up nearest atlas region
        if (operation === 'lookup' || operation === 'find_region' || operation === 'convert') {
          // Convert input to MNI if needed
          let mniX = x, mniY = y, mniZ = z
          if (fromSpace === 'talairach') {
            const mni = talToMni(x, y, z)
            mniX = mni.x; mniY = mni.y; mniZ = mni.z
          }

          parts.push('### Nearest Atlas Regions')
          const distances = MNI_ATLAS.map(entry => {
            const dx = mniX - entry.mni.x
            const dy = mniY - entry.mni.y
            const dz = mniZ - entry.mni.z
            return { entry, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) }
          }).sort((a, b) => a.dist - b.dist)

          parts.push(`**Query point** (MNI): (${mniX}, ${mniY}, ${mniZ})`)
          parts.push('')
          parts.push('| Rank | Region | MNI (x,y,z) | Distance (mm) | Brodmann |')
          parts.push('|---|---|---|---|---|')
          for (let i = 0; i < Math.min(10, distances.length); i++) {
            const d = distances[i]
            parts.push(`| ${i + 1} | ${d.entry.name} | (${d.entry.mni.x}, ${d.entry.mni.y}, ${d.entry.mni.z}) | ${fmt(d.dist, 3)} | ${d.entry.brodmann || '-'} |`)
          }

          if (distances[0].dist < 15) {
            parts.push('')
            parts.push(`**Best match**: ${distances[0].entry.name} (${fmt(distances[0].dist, 3)} mm away)`)
          } else {
            parts.push('')
            parts.push(`*Note: Nearest region is ${fmt(distances[0].dist, 3)} mm away. Coordinates may be in white matter or a region not in this atlas.*`)
          }
        }
      } else {
        // No coordinates provided — list atlas or find region by name
        const query = String(args.from_space || args.operation || '').toLowerCase()
        if (query && query !== 'mni' && query !== 'talairach' && query !== 'lookup') {
          // Search by name
          const matches = MNI_ATLAS.filter(e => e.name.toLowerCase().includes(query))
          if (matches.length > 0) {
            parts.push(`### Regions matching "${query}"`)
            parts.push('| Region | MNI (x,y,z) | Talairach (x,y,z) | Brodmann |')
            parts.push('|---|---|---|---|')
            for (const m of matches) {
              parts.push(`| ${m.name} | (${m.mni.x}, ${m.mni.y}, ${m.mni.z}) | (${m.talairach.x}, ${m.talairach.y}, ${m.talairach.z}) | ${m.brodmann || '-'} |`)
            }
          } else {
            parts.push(`No regions found matching "${query}".`)
          }
        } else {
          parts.push('### Complete MNI Atlas (' + MNI_ATLAS.length + ' regions)')
          parts.push('| Region | MNI (x,y,z) | Brodmann |')
          parts.push('|---|---|---|')
          for (const entry of MNI_ATLAS) {
            parts.push(`| ${entry.name} | (${entry.mni.x}, ${entry.mni.y}, ${entry.mni.z}) | ${entry.brodmann || '-'} |`)
          }
        }
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 10. Learning Model
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'learning_model',
    description: 'Computational models of learning: Rescorla-Wagner (classical conditioning), temporal difference, Q-learning (with grid world), SARSA, Hebbian learning, Bayesian learning. Simulates learning curves.',
    parameters: {
      model: { type: 'string', description: 'Model: rescorla_wagner, td, q_learning, sarsa, hebbian, bayesian', required: true },
      params: { type: 'string', description: 'JSON with model-specific parameters', required: true },
      trials: { type: 'number', description: 'Number of learning trials (default: 100)' },
    },
    tier: 'free',
    async execute(args) {
      const model = String(args.model).toLowerCase().replace(/[- ]/g, '_')
      const p = safeJSON(String(args.params)) as Record<string, unknown> | null
      if (!p) return 'Error: params must be valid JSON.'
      const nTrials = Math.min(Number(args.trials) || 100, 1000)

      const parts: string[] = []

      if (model === 'rescorla_wagner' || model === 'rw') {
        // Rescorla-Wagner: ΔV = α * β * (λ - ΣV)
        const alpha = Number(p.alpha || p.learning_rate || 0.3)       // CS salience
        const beta = Number(p.beta || 1.0)                            // US processing rate
        const lambda = Number(p.lambda || p.max_assoc || 1.0)         // asymptote
        const nCS = Number(p.n_cs || p.stimuli || 1)                  // number of CSs
        const extinction_start = Number(p.extinction_start || 0)       // trial to start extinction (0 = none)
        const reinstatement_trial = Number(p.reinstatement_trial || 0)

        const V = new Array(nCS).fill(0)
        const history: Array<{ trial: number; V: number[]; error: number }> = []

        parts.push('## Rescorla-Wagner Model (Classical Conditioning)')
        parts.push('')
        parts.push(`**Formula**: \u0394V = \u03B1 \u00D7 \u03B2 \u00D7 (\u03BB - \u03A3V)`)
        parts.push(`**Parameters**: \u03B1=${alpha}, \u03B2=${beta}, \u03BB=${lambda}, CSs=${nCS}`)
        if (extinction_start > 0) parts.push(`**Extinction begins**: trial ${extinction_start}`)
        parts.push('')

        for (let t = 1; t <= nTrials; t++) {
          const usPresent = extinction_start > 0 && t >= extinction_start && (reinstatement_trial === 0 || t < reinstatement_trial) ? 0 : lambda
          const sumV = V.reduce((a, b) => a + b, 0)
          const error = usPresent - sumV

          for (let cs = 0; cs < nCS; cs++) {
            const deltaV = alpha * beta * (usPresent - sumV)
            V[cs] += deltaV
          }

          history.push({ trial: t, V: [...V], error })
        }

        parts.push('### Learning Curve')
        parts.push('| Trial | ' + Array.from({ length: nCS }, (_, i) => `V(CS${i + 1})`).join(' | ') + ' | \u03A3V | Prediction Error |')
        parts.push('|---|' + Array.from({ length: nCS + 2 }, () => '---').join('|') + '|')
        const step = Math.max(1, Math.floor(nTrials / 25))
        for (let i = 0; i < history.length; i += step) {
          const h = history[i]
          const sumV = h.V.reduce((a, b) => a + b, 0)
          parts.push(`| ${h.trial} | ${h.V.map(v => fmt(v, 4)).join(' | ')} | ${fmt(sumV, 4)} | ${fmt(h.error, 4)} |`)
        }
        // Always show last trial
        const last = history[history.length - 1]
        const lastSum = last.V.reduce((a, b) => a + b, 0)
        parts.push(`| ${last.trial} | ${last.V.map(v => fmt(v, 4)).join(' | ')} | ${fmt(lastSum, 4)} | ${fmt(last.error, 4)} |`)
        parts.push('')
        parts.push(`**Final associative strength**: \u03A3V = ${fmt(lastSum, 4)}`)
        if (nCS > 1) {
          parts.push(`*With ${nCS} CSs, each acquires V = ${fmt(lastSum / nCS, 4)} (blocking/overshadowing)*`)
        }

      } else if (model === 'td' || model === 'temporal_difference') {
        // TD(0) learning on a Markov chain
        const alpha = Number(p.alpha || p.learning_rate || 0.1)
        const gamma = Number(p.gamma || p.discount || 0.9)
        const nStates = Math.min(Number(p.n_states || p.states || 5), 20)
        const rewardState = Number(p.reward_state ?? nStates - 1)
        const rewardValue = Number(p.reward || 1.0)

        const V = new Array(nStates).fill(0)
        const history: Array<{ trial: number; V: number[] }> = []

        parts.push('## Temporal Difference Learning — TD(0)')
        parts.push('')
        parts.push(`**Update rule**: V(s) \u2190 V(s) + \u03B1[\u03B4]  where \u03B4 = r + \u03B3V(s') - V(s)`)
        parts.push(`**Parameters**: \u03B1=${alpha}, \u03B3=${gamma}, states=${nStates}`)
        parts.push(`**Reward**: ${rewardValue} at state ${rewardState}`)
        parts.push('')

        for (let t = 0; t < nTrials; t++) {
          // Walk through states sequentially (Markov chain: S0 -> S1 -> ... -> S_terminal)
          for (let s = 0; s < nStates - 1; s++) {
            const r = s + 1 === rewardState ? rewardValue : 0
            const sNext = s + 1
            const td_error = r + gamma * V[sNext] - V[s]
            V[s] += alpha * td_error
          }
          // Terminal state resets
          V[nStates - 1] = 0

          if (t % Math.max(1, Math.floor(nTrials / 20)) === 0 || t === nTrials - 1) {
            history.push({ trial: t + 1, V: [...V] })
          }
        }

        parts.push('### Value Function Over Trials')
        parts.push('| Trial | ' + Array.from({ length: nStates }, (_, i) => `S${i}`).join(' | ') + ' |')
        parts.push('|---|' + Array.from({ length: nStates }, () => '---').join('|') + '|')
        for (const h of history) {
          parts.push(`| ${h.trial} | ${h.V.map(v => fmt(v, 4)).join(' | ')} |`)
        }
        parts.push('')

        // Analytical solution: V(s) = gamma^(rewardState - s - 1) * rewardValue for s < rewardState
        parts.push('### Analytical vs. Learned Values')
        parts.push('| State | Learned V | Analytical V | Error |')
        parts.push('|---|---|---|---|')
        for (let s = 0; s < nStates; s++) {
          const analytical = s < rewardState ? rewardValue * Math.pow(gamma, rewardState - s - 1) : 0
          parts.push(`| S${s} | ${fmt(V[s], 4)} | ${fmt(analytical, 4)} | ${fmt(Math.abs(V[s] - analytical), 4)} |`)
        }

      } else if (model === 'q_learning') {
        // Q-learning on a grid world
        // Q(s,a) ← Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
        const alpha = Number(p.alpha || p.learning_rate || 0.1)
        const gamma = Number(p.gamma || p.discount || 0.95)
        const epsilon = Number(p.epsilon || 0.1)
        const gridW = Math.min(Number(p.width || p.grid_width || 5), 10)
        const gridH = Math.min(Number(p.height || p.grid_height || 5), 10)
        const goalX = Number(p.goal_x ?? gridW - 1)
        const goalY = Number(p.goal_y ?? gridH - 1)
        const reward = Number(p.reward || 10)

        // Obstacles (optional)
        const obstacles = new Set<string>()
        if (p.obstacles && Array.isArray(p.obstacles)) {
          for (const o of p.obstacles as Array<{ x: number; y: number }>) {
            obstacles.add(`${o.x},${o.y}`)
          }
        }

        const nStates = gridW * gridH
        const actions = ['up', 'down', 'left', 'right']
        const Q: number[][] = Array.from({ length: nStates }, () => new Array(4).fill(0))
        const stateVisits = new Array(nStates).fill(0)

        function stateIdx(x: number, y: number): number { return y * gridW + x }
        function isValid(x: number, y: number): boolean {
          return x >= 0 && x < gridW && y >= 0 && y < gridH && !obstacles.has(`${x},${y}`)
        }

        function step(x: number, y: number, action: number): { nx: number; ny: number; r: number } {
          let nx = x, ny = y
          if (action === 0) ny = y - 1       // up
          else if (action === 1) ny = y + 1   // down
          else if (action === 2) nx = x - 1   // left
          else if (action === 3) nx = x + 1   // right

          if (!isValid(nx, ny)) { nx = x; ny = y }  // wall bounce

          const r = (nx === goalX && ny === goalY) ? reward : -0.1  // small step penalty
          return { nx, ny, r }
        }

        const episodeRewards: number[] = []

        for (let trial = 0; trial < nTrials; trial++) {
          let x = 0, y = 0
          let totalReward = 0
          let steps = 0
          const maxSteps = gridW * gridH * 4

          while (!(x === goalX && y === goalY) && steps < maxSteps) {
            const s = stateIdx(x, y)
            stateVisits[s]++

            // Epsilon-greedy action selection
            let action: number
            if (Math.random() < epsilon) {
              action = Math.floor(Math.random() * 4)
            } else {
              action = Q[s].indexOf(Math.max(...Q[s]))
            }

            const { nx, ny, r } = step(x, y, action)
            const sNext = stateIdx(nx, ny)

            // Q-learning update: Q(s,a) ← Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
            const maxQ_next = Math.max(...Q[sNext])
            Q[s][action] += alpha * (r + gamma * maxQ_next - Q[s][action])

            totalReward += r
            x = nx
            y = ny
            steps++
          }

          episodeRewards.push(totalReward)
        }

        parts.push('## Q-Learning (Grid World)')
        parts.push('')
        parts.push(`**Update**: Q(s,a) \u2190 Q(s,a) + \u03B1[r + \u03B3\u00B7max Q(s\',a\') - Q(s,a)]`)
        parts.push(`**Parameters**: \u03B1=${alpha}, \u03B3=${gamma}, \u03B5=${epsilon}`)
        parts.push(`**Grid**: ${gridW}x${gridH} | **Goal**: (${goalX}, ${goalY}) | **Reward**: ${reward}`)
        if (obstacles.size > 0) parts.push(`**Obstacles**: ${[...obstacles].join('; ')}`)
        parts.push('')

        // Show learned policy
        parts.push('### Learned Policy (best action per state)')
        const arrowMap = ['\u2191', '\u2193', '\u2190', '\u2192']  // up, down, left, right
        let grid = '```\n'
        for (let y = 0; y < gridH; y++) {
          let row = ''
          for (let x = 0; x < gridW; x++) {
            if (x === goalX && y === goalY) {
              row += ' G '
            } else if (obstacles.has(`${x},${y}`)) {
              row += ' # '
            } else {
              const s = stateIdx(x, y)
              const bestAction = Q[s].indexOf(Math.max(...Q[s]))
              row += ` ${arrowMap[bestAction]} `
            }
          }
          grid += row + '\n'
        }
        grid += '```'
        parts.push(grid)
        parts.push('')

        // Q-value table for key states
        parts.push('### Q-Values (selected states)')
        parts.push('| State (x,y) | Q(up) | Q(down) | Q(left) | Q(right) | Best |')
        parts.push('|---|---|---|---|---|---|')
        for (let y = 0; y < gridH; y++) {
          for (let x = 0; x < gridW; x++) {
            if (obstacles.has(`${x},${y}`)) continue
            const s = stateIdx(x, y)
            if (stateVisits[s] > 0) {
              const best = Q[s].indexOf(Math.max(...Q[s]))
              parts.push(`| (${x},${y}) | ${fmt(Q[s][0], 3)} | ${fmt(Q[s][1], 3)} | ${fmt(Q[s][2], 3)} | ${fmt(Q[s][3], 3)} | ${actions[best]} |`)
            }
          }
        }
        parts.push('')

        // Learning curve
        parts.push('### Learning Curve (episode rewards)')
        const bucketSize = Math.max(1, Math.floor(nTrials / 20))
        parts.push('| Episodes | Mean Reward | Min | Max |')
        parts.push('|---|---|---|---|')
        for (let i = 0; i < nTrials; i += bucketSize) {
          const bucket = episodeRewards.slice(i, i + bucketSize)
          const mean = bucket.reduce((a, b) => a + b, 0) / bucket.length
          parts.push(`| ${i + 1}-${Math.min(i + bucketSize, nTrials)} | ${fmt(mean, 4)} | ${fmt(Math.min(...bucket), 4)} | ${fmt(Math.max(...bucket), 4)} |`)
        }

      } else if (model === 'sarsa') {
        // SARSA: Q(s,a) ← Q(s,a) + α[r + γ·Q(s',a') - Q(s,a)]
        const alpha = Number(p.alpha || p.learning_rate || 0.1)
        const gamma = Number(p.gamma || p.discount || 0.95)
        const epsilon = Number(p.epsilon || 0.1)
        const gridW = Math.min(Number(p.width || 5), 10)
        const gridH = Math.min(Number(p.height || 5), 10)
        const goalX = Number(p.goal_x ?? gridW - 1)
        const goalY = Number(p.goal_y ?? gridH - 1)
        const reward = Number(p.reward || 10)

        // Cliff world: penalty zone
        const cliffPenalty = Number(p.cliff_penalty || -100)
        const hasCliff = Boolean(p.cliff)

        const nStates = gridW * gridH
        const Q: number[][] = Array.from({ length: nStates }, () => new Array(4).fill(0))
        function stateIdx(x: number, y: number): number { return y * gridW + x }
        function isValid(x: number, y: number): boolean { return x >= 0 && x < gridW && y >= 0 && y < gridH }

        function isCliff(x: number, y: number): boolean {
          if (!hasCliff) return false
          return y === gridH - 1 && x > 0 && x < gridW - 1
        }

        function step(x: number, y: number, action: number): { nx: number; ny: number; r: number } {
          let nx = x, ny = y
          if (action === 0) ny--
          else if (action === 1) ny++
          else if (action === 2) nx--
          else if (action === 3) nx++
          if (!isValid(nx, ny)) { nx = x; ny = y }
          let r = -1
          if (isCliff(nx, ny)) { r = cliffPenalty; nx = 0; ny = gridH - 1 }
          if (nx === goalX && ny === goalY) r = reward
          return { nx, ny, r }
        }

        function chooseAction(s: number): number {
          if (Math.random() < epsilon) return Math.floor(Math.random() * 4)
          return Q[s].indexOf(Math.max(...Q[s]))
        }

        const episodeRewards: number[] = []

        for (let trial = 0; trial < nTrials; trial++) {
          let x = 0, y = hasCliff ? gridH - 1 : 0
          let s = stateIdx(x, y)
          let a = chooseAction(s)
          let totalReward = 0
          let steps = 0

          while (!(x === goalX && y === goalY) && steps < gridW * gridH * 4) {
            const { nx, ny, r } = step(x, y, a)
            const sNext = stateIdx(nx, ny)
            const aNext = chooseAction(sNext)

            // SARSA update: Q(s,a) ← Q(s,a) + α[r + γ·Q(s',a') - Q(s,a)]
            Q[s][a] += alpha * (r + gamma * Q[sNext][aNext] - Q[s][a])

            totalReward += r
            x = nx; y = ny; s = sNext; a = aNext
            steps++
          }
          episodeRewards.push(totalReward)
        }

        parts.push('## SARSA Learning (On-Policy TD Control)')
        parts.push('')
        parts.push(`**Update**: Q(s,a) \u2190 Q(s,a) + \u03B1[r + \u03B3\u00B7Q(s\',a\') - Q(s,a)]`)
        parts.push(`**Parameters**: \u03B1=${alpha}, \u03B3=${gamma}, \u03B5=${epsilon}`)
        parts.push(`**Grid**: ${gridW}x${gridH}${hasCliff ? ' (cliff world)' : ''}`)
        parts.push('')

        // Policy visualization
        const arrowMap = ['\u2191', '\u2193', '\u2190', '\u2192']
        parts.push('### Learned Policy')
        let grid = '```\n'
        for (let y = 0; y < gridH; y++) {
          let row = ''
          for (let x = 0; x < gridW; x++) {
            if (x === goalX && y === goalY) row += ' G '
            else if (isCliff(x, y)) row += ' C '
            else {
              const s = stateIdx(x, y)
              row += ` ${arrowMap[Q[s].indexOf(Math.max(...Q[s]))]} `
            }
          }
          grid += row + '\n'
        }
        grid += '```'
        parts.push(grid)
        parts.push('')

        // Note difference from Q-learning
        parts.push('### SARSA vs Q-Learning Comparison')
        parts.push('- **SARSA** (on-policy): Learns policy it actually follows, accounts for exploration')
        parts.push('- **Q-learning** (off-policy): Learns optimal policy regardless of behavior')
        parts.push('- In cliff worlds, SARSA takes safer path; Q-learning walks the cliff edge')
        parts.push('')

        const lastBucket = episodeRewards.slice(-10)
        parts.push(`**Final 10 episodes avg reward**: ${fmt(lastBucket.reduce((a, b) => a + b, 0) / lastBucket.length, 4)}`)

      } else if (model === 'hebbian') {
        // Hebbian learning: Δw = η * x * y
        const eta = Number(p.eta || p.learning_rate || 0.01)
        const nPre = Math.min(Number(p.n_pre || p.inputs || 5), 20)
        const nPost = Math.min(Number(p.n_post || p.outputs || 3), 10)
        const normalize = Boolean(p.normalize ?? true)
        const rule = String(p.rule || 'basic').toLowerCase()

        // Weight matrix
        const W: number[][] = Array.from({ length: nPost }, () =>
          Array.from({ length: nPre }, () => (Math.random() - 0.5) * 0.1))

        const weightHistory: Array<{ trial: number; avgW: number; maxW: number; normW: number }> = []

        parts.push('## Hebbian Learning')
        parts.push('')
        if (rule === 'oja') {
          parts.push(`**Oja's Rule**: \u0394w = \u03B7 \u00D7 y \u00D7 (x - y \u00D7 w)  (normalized Hebb)`)
        } else if (rule === 'bcm') {
          parts.push(`**BCM Rule**: \u0394w = \u03B7 \u00D7 y \u00D7 (y - \u03B8) \u00D7 x  (sliding threshold)`)
        } else {
          parts.push(`**Basic Hebb**: \u0394w = \u03B7 \u00D7 x \u00D7 y`)
        }
        parts.push(`**Parameters**: \u03B7=${eta}, pre=${nPre}, post=${nPost}, normalize=${normalize}`)
        parts.push('')

        let theta = 0.5  // BCM threshold

        for (let t = 0; t < nTrials; t++) {
          // Generate random input pattern
          const x = Array.from({ length: nPre }, () => Math.random())

          // Compute output
          const y = new Array(nPost).fill(0)
          for (let j = 0; j < nPost; j++) {
            for (let i = 0; i < nPre; i++) {
              y[j] += W[j][i] * x[i]
            }
            y[j] = Math.max(0, y[j])  // ReLU activation
          }

          // Update weights
          for (let j = 0; j < nPost; j++) {
            for (let i = 0; i < nPre; i++) {
              if (rule === 'oja') {
                W[j][i] += eta * y[j] * (x[i] - y[j] * W[j][i])
              } else if (rule === 'bcm') {
                W[j][i] += eta * y[j] * (y[j] - theta) * x[i]
              } else {
                W[j][i] += eta * x[i] * y[j]
              }
            }
          }

          // BCM: update threshold
          if (rule === 'bcm') {
            const avgY2 = y.reduce((s, yi) => s + yi * yi, 0) / nPost
            theta = theta * 0.99 + avgY2 * 0.01
          }

          // Normalize weights if requested (Oja's rule is self-normalizing)
          if (normalize && rule !== 'oja') {
            for (let j = 0; j < nPost; j++) {
              const norm = Math.sqrt(W[j].reduce((s, w) => s + w * w, 0))
              if (norm > 1) {
                for (let i = 0; i < nPre; i++) W[j][i] /= norm
              }
            }
          }

          // Record stats
          if (t % Math.max(1, Math.floor(nTrials / 20)) === 0 || t === nTrials - 1) {
            const allW = W.flat()
            const avgW = allW.reduce((a, b) => a + Math.abs(b), 0) / allW.length
            const maxW = Math.max(...allW.map(Math.abs))
            const normW = Math.sqrt(allW.reduce((s, w) => s + w * w, 0))
            weightHistory.push({ trial: t + 1, avgW, maxW, normW })
          }
        }

        parts.push('### Weight Evolution')
        parts.push('| Trial | Avg |W| | Max |W| | ||W|| |')
        parts.push('|---|---|---|---|')
        for (const h of weightHistory) {
          parts.push(`| ${h.trial} | ${fmt(h.avgW, 4)} | ${fmt(h.maxW, 4)} | ${fmt(h.normW, 4)} |`)
        }
        parts.push('')

        parts.push('### Final Weight Matrix')
        parts.push('| Post \\ Pre | ' + Array.from({ length: nPre }, (_, i) => `x${i}`).join(' | ') + ' |')
        parts.push('|---|' + Array.from({ length: nPre }, () => '---').join('|') + '|')
        for (let j = 0; j < nPost; j++) {
          parts.push(`| y${j} | ${W[j].map(w => fmt(w, 3)).join(' | ')} |`)
        }
        parts.push('')
        parts.push('### Properties')
        if (rule === 'oja') {
          parts.push("- Oja's rule extracts the first principal component")
          parts.push('- Weights are self-normalizing (no weight explosion)')
        } else if (rule === 'bcm') {
          parts.push('- BCM develops orientation selectivity')
          parts.push('- Sliding threshold prevents runaway excitation')
        } else {
          parts.push('- Basic Hebb is unstable without normalization (weights explode)')
          parts.push('- "Neurons that fire together wire together"')
        }

      } else if (model === 'bayesian') {
        // Bayesian learning: update prior with evidence
        const priorMean = Number(p.prior_mean || p.mu_0 || 0)
        const priorVar = Number(p.prior_var || p.sigma_0_sq || 1)
        const likelihoodVar = Number(p.likelihood_var || p.sigma_sq || 1)
        const trueValue = Number(p.true_value || p.theta || 1.0)

        parts.push('## Bayesian Learning (Gaussian)')
        parts.push('')
        parts.push(`**Prior**: N(\u03BC\u2080=${priorMean}, \u03C3\u2080\u00B2=${priorVar})`)
        parts.push(`**Likelihood**: N(\u03B8, \u03C3\u00B2=${likelihoodVar})`)
        parts.push(`**True value (\u03B8)**: ${trueValue}`)
        parts.push('')
        parts.push(`**Posterior update**: \u03BC_n = (\u03C3\u00B2\u00B7\u03BC_{n-1} + \u03C3\u00B2_{n-1}\u00B7x_n) / (\u03C3\u00B2 + \u03C3\u00B2_{n-1})`)
        parts.push('')

        let mu = priorMean
        let sigma2 = priorVar

        const history: Array<{ trial: number; observation: number; mu: number; sigma2: number; ci_low: number; ci_high: number }> = []

        for (let t = 1; t <= nTrials; t++) {
          // Generate noisy observation
          const observation = trueValue + Math.sqrt(likelihoodVar) * gaussianRandom()

          // Bayesian update (conjugate prior for Gaussian)
          const newSigma2 = 1 / (1 / sigma2 + 1 / likelihoodVar)
          const newMu = newSigma2 * (mu / sigma2 + observation / likelihoodVar)

          mu = newMu
          sigma2 = newSigma2

          if (t <= 10 || t % Math.max(1, Math.floor(nTrials / 20)) === 0 || t === nTrials) {
            const ci = 1.96 * Math.sqrt(sigma2)
            history.push({ trial: t, observation, mu, sigma2, ci_low: mu - ci, ci_high: mu + ci })
          }
        }

        parts.push('### Posterior Evolution')
        parts.push('| Trial | Observation | Posterior \u03BC | Posterior \u03C3\u00B2 | 95% CI |')
        parts.push('|---|---|---|---|---|')
        parts.push(`| 0 (prior) | - | ${fmt(priorMean, 4)} | ${fmt(priorVar, 4)} | [${fmt(priorMean - 1.96 * Math.sqrt(priorVar), 4)}, ${fmt(priorMean + 1.96 * Math.sqrt(priorVar), 4)}] |`)
        for (const h of history) {
          parts.push(`| ${h.trial} | ${fmt(h.observation, 4)} | ${fmt(h.mu, 4)} | ${fmt(h.sigma2, 6)} | [${fmt(h.ci_low, 4)}, ${fmt(h.ci_high, 4)}] |`)
        }
        parts.push('')
        parts.push(`**Final estimate**: \u03B8 \u2248 ${fmt(mu, 6)} \u00B1 ${fmt(1.96 * Math.sqrt(sigma2), 6)} (95% CI)`)
        parts.push(`**True value**: ${trueValue}`)
        parts.push(`**Error**: ${fmt(Math.abs(mu - trueValue), 6)}`)
        parts.push('')
        parts.push('### Key Properties')
        parts.push('- Posterior variance shrinks as ~1/n (precision grows linearly)')
        parts.push('- Posterior mean is a precision-weighted average of prior and data')
        parts.push('- As n\u2192\u221E, posterior concentrates on true value (consistency)')
        parts.push(`- After ${nTrials} observations, uncertainty reduced by factor of ${fmt(priorVar / sigma2, 3)}x`)

      } else {
        return `Unknown model: "${model}". Supported: rescorla_wagner, td, q_learning, sarsa, hebbian, bayesian`
      }

      return parts.join('\n')
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 11. Brain Activation Prediction
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'brain_predict',
    description: 'Predict brain activation patterns from stimulus descriptions. Maps stimulus features to expected brain region activations based on established neuroscience literature. Supports visual, auditory, text/language, motor, emotional, and social stimulus types.',
    parameters: {
      stimulus: { type: 'string', description: 'Describe the stimulus (e.g., "a face showing fear moving across a red background")', required: true },
      stimulus_type: { type: 'string', description: 'Stimulus modality: visual, auditory, text, motor, emotional, social (default: visual)' },
      detail_level: { type: 'string', description: 'Output detail: overview or detailed (default: overview)' },
    },
    tier: 'free',
    async execute(args) {
      const stimulus = String(args.stimulus || '').toLowerCase()
      const stimType = String(args.stimulus_type || 'visual').toLowerCase()
      const detail = String(args.detail_level || 'overview').toLowerCase()

      if (!stimulus) return 'Error: stimulus description is required.'

      // ── Feature-to-region mapping based on neuroscience literature ──

      interface RegionActivation {
        region: string
        activation: number  // 0-1
        function: string
        reasoning: string
      }

      const activations: RegionActivation[] = []

      function add(region: string, activation: number, fn: string, reasoning: string): void {
        // Check if already added, keep higher activation
        const existing = activations.find(a => a.region === region)
        if (existing) {
          if (activation > existing.activation) {
            existing.activation = activation
            existing.function = fn
            existing.reasoning = reasoning
          }
        } else {
          activations.push({ region, activation: Math.min(1, Math.max(0, activation)), function: fn, reasoning })
        }
      }

      // ── Visual features ──
      if (stimType === 'visual' || /\b(see|look|watch|view|image|picture|photo|scene|display|screen)\b/.test(stimulus)) {
        add('V1/V2 (Primary Visual)', 0.8, 'Edge detection, orientation', 'All visual stimuli activate primary visual cortex')

        if (/\b(color|red|blue|green|yellow|orange|purple|hue|bright|colorful|chromatic)\b/.test(stimulus)) {
          add('V4 (Color Area)', 0.85, 'Color perception', 'Color features detected in stimulus')
        }
        if (/\b(move|motion|moving|flow|speed|drift|rotate|spin|flying|running|walking)\b/.test(stimulus)) {
          add('V5/MT (Motion Area)', 0.9, 'Motion perception', 'Motion features detected in stimulus')
          add('Dorsal Stream (Parietal)', 0.7, 'Where/how processing', 'Motion engages dorsal spatial stream')
        }
        if (/\b(face|facial|expression|person|people|portrait|eye|smile|frown)\b/.test(stimulus)) {
          add('FFA (Fusiform Face Area)', 0.95, 'Face processing', 'Face/facial features detected')
          add('STS (Superior Temporal Sulcus)', 0.6, 'Biological motion, gaze', 'Face stimuli engage social perception')
        }
        if (/\b(place|scene|room|building|landscape|house|city|street|indoor|outdoor|environment)\b/.test(stimulus)) {
          add('PPA (Parahippocampal Place Area)', 0.9, 'Scene/place processing', 'Place/scene features detected')
        }
        if (/\b(object|tool|car|chair|animal|thing|item|shape)\b/.test(stimulus)) {
          add('LOC (Lateral Occipital Complex)', 0.85, 'Object recognition', 'Object features detected')
          add('Ventral Stream (Temporal)', 0.75, 'What processing', 'Object identity engages ventral stream')
        }
        if (/\b(word|text|letter|read|written|sign|label)\b/.test(stimulus)) {
          add('VWFA (Visual Word Form Area)', 0.9, 'Visual word recognition', 'Written text features detected')
        }
        if (/\b(where|location|spatial|position|distance|depth|reach|grasp)\b/.test(stimulus)) {
          add('Dorsal Stream (Parietal)', 0.8, 'Where/how processing', 'Spatial features engage dorsal stream')
        }
      }

      // ── Auditory features ──
      if (stimType === 'auditory' || /\b(hear|listen|sound|audio|noise|music|tone|voice|speech|song|melody)\b/.test(stimulus)) {
        add("A1 (Primary Auditory / Heschl's Gyrus)", 0.85, 'Sound processing', 'All auditory stimuli activate primary auditory cortex')

        if (/\b(tone|pure|frequency|pitch|beep|hz|hertz|sine)\b/.test(stimulus)) {
          add("Heschl's Gyrus", 0.9, 'Pure tone processing', 'Simple tonal features detected')
        }
        if (/\b(speech|talk|word|sentence|language|conversation|speak|voice|said)\b/.test(stimulus)) {
          add("Wernicke's Area (STG)", 0.9, 'Language comprehension', 'Speech/language features detected')
          add('Left IFG (Broca\'s)', 0.5, 'Speech processing', 'Speech perception coactivates production areas')
        }
        if (/\b(voice|speaker|vocal|human|person)\b/.test(stimulus)) {
          add('Superior Temporal (Voice Area)', 0.85, 'Voice identity processing', 'Human voice features detected')
        }
        if (/\b(music|melody|harmony|rhythm|song|instrument|chord|beat)\b/.test(stimulus)) {
          add('Planum Temporale', 0.8, 'Complex sound analysis', 'Musical/complex sound features detected')
          add('Right Hemisphere Auditory', 0.7, 'Melodic processing', 'Music engages right-lateralized processing')
        }
      }

      // ── Text/Language features ──
      if (stimType === 'text' || /\b(read|write|sentence|grammar|syntax|word|meaning|comprehend|language)\b/.test(stimulus)) {
        add("Broca's Area (Left IFG)", 0.8, 'Language production/syntax', 'Language processing engages Broca\'s area')
        add("Wernicke's Area (STG)", 0.8, 'Language comprehension', 'Language comprehension processing')
        add('Angular Gyrus', 0.7, 'Semantic processing', 'Meaning extraction engages angular gyrus')

        if (/\b(read|written|text|book|letter|word)\b/.test(stimulus)) {
          add('VWFA (Visual Word Form Area)', 0.9, 'Reading/orthography', 'Written text processing detected')
        }
        if (/\b(grammar|syntax|structure|parse|sentence)\b/.test(stimulus)) {
          add('Left IFG (BA 44/45)', 0.85, 'Syntactic processing', 'Grammatical features detected')
        }
        if (/\b(meaning|semantic|concept|definition|understand)\b/.test(stimulus)) {
          add('Angular Gyrus', 0.85, 'Semantic integration', 'Semantic processing features detected')
          add('Anterior Temporal Lobe', 0.7, 'Conceptual knowledge', 'Meaning extraction engages ATL')
        }
      }

      // ── Motor features ──
      if (stimType === 'motor' || /\b(move|reach|grasp|press|tap|walk|run|jump|kick|throw|point|gesture)\b/.test(stimulus)) {
        add('M1 (Primary Motor Cortex)', 0.85, 'Movement execution', 'Motor actions engage primary motor cortex')
        add('SMA (Supplementary Motor Area)', 0.7, 'Movement planning/sequencing', 'Motor planning for action sequences')

        if (/\b(plan|prepare|intend|imagine move|rehearse)\b/.test(stimulus)) {
          add('Premotor Cortex', 0.85, 'Movement preparation', 'Motor preparation features detected')
          add('SMA', 0.8, 'Sequence planning', 'Movement planning detected')
        }
        if (/\b(coordinate|balance|precise|fine|skilled|timing)\b/.test(stimulus)) {
          add('Cerebellum', 0.85, 'Motor coordination/timing', 'Coordination demands detected')
        }
        if (/\b(choose|select|switch|decide|habit)\b/.test(stimulus)) {
          add('Basal Ganglia (Striatum)', 0.8, 'Action selection', 'Action selection/switching detected')
        }
        if (/\b(hand|finger|grip|grasp|manipulate)\b/.test(stimulus)) {
          add('M1 (Hand Area)', 0.9, 'Fine motor control', 'Hand/finger motor features detected')
          add('Cerebellum', 0.7, 'Fine coordination', 'Precision grasp demands')
        }
      }

      // ── Emotional features ──
      if (stimType === 'emotional' || /\b(fear|anger|happy|sad|disgust|surprise|emotion|threat|danger|reward|punish|stress|anxiety|joy|love|hate)\b/.test(stimulus)) {
        if (/\b(fear|threat|danger|alarm|scary|frightening|startl|avers)\b/.test(stimulus)) {
          add('Amygdala', 0.95, 'Threat detection/fear', 'Threat/fear features strongly activate amygdala')
          add('PAG (Periaqueductal Gray)', 0.6, 'Defensive behavior', 'Threat triggers defensive circuits')
        }
        if (/\b(disgust|revuls|nause|gross|contaminat)\b/.test(stimulus)) {
          add('Anterior Insula', 0.9, 'Disgust/interoception', 'Disgust features detected')
        }
        if (/\b(reward|pleasant|enjoy|like|want|crave|desire)\b/.test(stimulus)) {
          add('vmPFC (Ventromedial PFC)', 0.8, 'Value/reward', 'Reward valuation features detected')
          add('OFC (Orbitofrontal Cortex)', 0.8, 'Reward processing', 'Reward features engage OFC')
          add('Nucleus Accumbens', 0.75, 'Reward/pleasure', 'Reward anticipation/receipt')
        }
        if (/\b(conflict|difficult|error|uncertain|ambiguous)\b/.test(stimulus)) {
          add('ACC (Anterior Cingulate)', 0.85, 'Conflict monitoring', 'Conflict/uncertainty features detected')
        }
        add('Amygdala', 0.6, 'Emotional salience', 'Emotional stimuli engage amygdala for salience')
        if (/\b(memory|remember|context|familiar|past)\b/.test(stimulus)) {
          add('Hippocampus', 0.7, 'Emotional context/memory', 'Contextual memory for emotional processing')
        }
      }

      // ── Social features ──
      if (stimType === 'social' || /\b(person|people|social|interact|group|friend|stranger|communicat|cooperat|compet|trust|betray|empathy|moral)\b/.test(stimulus)) {
        add('TPJ (Temporoparietal Junction)', 0.85, 'Theory of mind', 'Social stimuli engage mentalizing')
        add('mPFC (Medial Prefrontal Cortex)', 0.8, 'Self/other distinction', 'Social cognition engages mPFC')

        if (/\b(face|expression|gaze|eye contact|look at)\b/.test(stimulus)) {
          add('FFA (Fusiform Face Area)', 0.9, 'Face processing', 'Social face processing detected')
        }
        if (/\b(move|gesture|body|action|imitat|mirror)\b/.test(stimulus)) {
          add('STS (Superior Temporal Sulcus)', 0.85, 'Biological motion', 'Social motion features detected')
          add('Mirror Neuron System (PMC/IFG)', 0.75, 'Action understanding/imitation', 'Imitation/observation of actions')
        }
        if (/\b(moral|ethical|fair|unfair|right|wrong|justice)\b/.test(stimulus)) {
          add('vmPFC', 0.8, 'Moral judgment', 'Moral reasoning features detected')
          add('TPJ', 0.85, 'Perspective taking', 'Moral scenarios require perspective taking')
        }
        if (/\b(empathy|sympathy|pain|suffer|feel for)\b/.test(stimulus)) {
          add('Anterior Insula', 0.8, 'Empathic processing', 'Empathy features detected')
          add('ACC', 0.7, 'Empathic pain', 'Shared pain representation')
        }
      }

      // If no activations were generated, add baseline for the stimulus type
      if (activations.length === 0) {
        add('Prefrontal Cortex', 0.5, 'Executive processing', 'Default engagement for cognitive processing')
        add('Thalamus', 0.4, 'Sensory relay', 'Thalamic gating of sensory input')
      }

      // Sort by activation level descending
      activations.sort((a, b) => b.activation - a.activation)

      // ── Format output ──
      const parts: string[] = []
      parts.push('## Brain Activation Prediction')
      parts.push('')
      parts.push(`**Stimulus**: "${args.stimulus}"`)
      parts.push(`**Type**: ${stimType}`)
      parts.push(`**Regions activated**: ${activations.length}`)
      parts.push('')

      // Activation bar helper
      function bar(level: number): string {
        const filled = Math.round(level * 10)
        return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled)
      }

      parts.push('### Predicted Activation Map')
      parts.push('')
      parts.push('| Region | Activation | Level | Function | Reasoning |')
      parts.push('|--------|-----------|-------|----------|-----------|')
      const limit = detail === 'detailed' ? activations.length : Math.min(activations.length, 8)
      for (let i = 0; i < limit; i++) {
        const a = activations[i]
        const level = a.activation >= 0.8 ? 'HIGH' : a.activation >= 0.5 ? 'MED' : 'LOW'
        parts.push(`| ${a.region} | ${bar(a.activation)} ${fmt(a.activation, 2)} | ${level} | ${a.function} | ${a.reasoning} |`)
      }

      if (detail === 'detailed') {
        parts.push('')
        parts.push('### Processing Streams')
        const hasDorsal = activations.some(a => /dorsal|parietal|where|spatial/i.test(a.region))
        const hasVentral = activations.some(a => /ventral|temporal|what|object|face/i.test(a.region))
        if (hasDorsal) parts.push('- **Dorsal ("where/how")**: Active - spatial/action processing engaged')
        if (hasVentral) parts.push('- **Ventral ("what")**: Active - object/identity processing engaged')
        if (!hasDorsal && !hasVentral) parts.push('- No dominant visual processing stream identified')

        parts.push('')
        parts.push('### Network Engagement')
        const hasDefault = activations.some(a => /mpfc|precuneus|posterior cingulate|angular/i.test(a.region.toLowerCase()))
        const hasSalience = activations.some(a => /insula|acc|amygdala/i.test(a.region.toLowerCase()))
        const hasExecutive = activations.some(a => /dlpfc|prefrontal|ips/i.test(a.region.toLowerCase()))
        if (hasDefault) parts.push('- **Default Mode Network**: Engaged (self-referential/social processing)')
        if (hasSalience) parts.push('- **Salience Network**: Engaged (emotional/interoceptive processing)')
        if (hasExecutive) parts.push('- **Executive Network**: Engaged (cognitive control/attention)')
        if (!hasDefault && !hasSalience && !hasExecutive) parts.push('- Primarily sensory processing (no major network hubs identified)')

        parts.push('')
        parts.push('### Lateralization')
        const leftLateral = activations.some(a => /broca|wernicke|vwfa|left ifg|angular/i.test(a.region.toLowerCase()))
        const rightLateral = activations.some(a => /right hemisphere|prosody|spatial/i.test(a.region.toLowerCase()))
        if (leftLateral && !rightLateral) parts.push('- **Left-lateralized**: Language/analytical processing dominant')
        else if (rightLateral && !leftLateral) parts.push('- **Right-lateralized**: Spatial/prosodic processing dominant')
        else parts.push('- **Bilateral**: Both hemispheres engaged')
      }

      parts.push('')
      parts.push('---')
      parts.push('*Predictions based on established neuroscience literature (fMRI/PET meta-analyses). Actual activation patterns vary by individual, attention state, and task demands.*')

      return parts.join('\n')
    },
  })
}

// ─── Gaussian random helper (Box-Muller) ─────────────────────────────────────

function gaussianRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}
