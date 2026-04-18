/* ──────────────────────────────────────────────────────────────
   ISSUE 367 — APRIL 2026
   THE SIEVE: ON PRESELECTION IN BEHAVIORAL GENETICS
   選別号 — 研究が始まる前の部屋

   An essay on the quiet moment before a behavioral-genetics study
   begins — the one where the sample is chosen, the twins enrolled,
   the questionnaires answered. Every heritability number downstream
   is a statement about who made it into the room. This issue walks
   the sieve slowly and itemizes what falls through.

   Ink stock + asymmetric-left layout — first run of this combo.
   Dark paper reads archival, specimen-label serious; asymmetric-
   left gives the magazine's most technical topic an editorial-
   column rhythm instead of a monument. A study number on the
   front page of a methods paper, rendered at magazine weight.

   8 sections, expanded over the first cut — Biobank volunteer
   bias, twin-registry ascertainment, self-report truncation,
   GWAS ancestry skew, clinical vs population sieves, the
   Pirastu "participation-as-phenotype" finding, the missing-
   heritability gap, and a closing cultural turn back on the
   magazine itself.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_367: IssueRecord = {
  number: '367',
  month: 'APRIL',
  year: '2026',
  feature: 'THE SIEVE: ON PRESELECTION IN BEHAVIORAL GENETICS',
  featureJp: '選別号 — 研究が始まる前の部屋',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  /** Cover identity — ink stock + asymmetric-left layout. First
      use of this combination. Dark paper gives the issue an
      archival, specimen-label seriousness; asymmetric-left slots
      the magazine's most technical topic into an editorial column
      rather than a monument. The cover reads like the front page
      of a methods paper rendered at magazine weight. */
  coverStock: 'ink',
  coverLayout: 'asymmetric-left',

  headline: {
    prefix: 'The',
    emphasis: 'Sieve',
    suffix: 'Issue',
    swash: 'Who gets counted, and who doesn\u2019t, in behavioral genetics.',
  },

  contents: [
    { n: '001', en: 'Who the study finds', jp: 'サンプルの限界', tag: 'METHOD' },
    { n: '002', en: 'The willing twin', jp: '応じる双子', tag: 'REGISTRY' },
    { n: '003', en: 'The honest self-report', jp: '自己申告の限界', tag: 'MEASURE' },
    { n: '004', en: 'What ancestry filters', jp: '祖先というフィルター', tag: 'ANCESTRY' },
    { n: '005', en: 'The clinic isn\u2019t the world', jp: '病院の外', tag: 'CLINICAL' },
    { n: '006', en: 'Participation as phenotype', jp: '参加することの遺伝性', tag: 'PARTICIPATION' },
    { n: '007', en: 'The missing heritability', jp: '見えない遺伝率', tag: 'GAP' },
    { n: '008', en: 'What escapes the sieve', jp: '網からこぼれるもの', tag: 'ESSAY' },
  ],

  spread: {
    type: 'essay',
    kicker: 'METHOD SPREAD · 方法論',
    title: 'The Room Before the Study.',
    titleJp: '研究が始まる前の部屋。',
    deck: 'Notes on preselection in behavioral genetics — what the field can see, what it can\u2019t, and why the answer depends on who walked into the room first.',
    byline: 'BY THE EDITORS \u00b7 KERNEL.CHAT',
    stock: 'ink',

    sections: [
      {
        heading: 'WHO THE STUDY FINDS',
        headingJp: 'サンプルの限界',
        paragraphs: [
          'A behavioral-genetics study is a machine that turns measurements of people into statements about human nature. The machine works — it has given us the heritability of intelligence, the family risk of schizophrenia, the twin studies that underpin a century of developmental psychology, the polygenic scores that are beginning, tentatively and imperfectly, to enter clinical practice. What the machine cannot do is study people it does not find. Every number it produces is a statement about the subset of humans who agreed to be measured, and the field has been, for most of its history, strangely quiet about who that subset is.',
          'The UK Biobank is the largest and most celebrated behavioral-genetics resource of the last decade — half a million volunteers, deep phenotyping, linked medical records, open-access summary statistics that have powered thousands of papers. Its participants are, on average, five years older, wealthier, better-educated, more female, and measurably healthier than the UK population it was meant to represent. The response rate at recruitment was 5.5 percent. The people who said yes were not the British; they were a self-selected slice of the British — the retired schoolteacher in Hampshire who reads the local paper, the civil servant in Leeds who likes the idea of contributing to science. Every heritability estimate derived from the Biobank is a statement about that slice. The field calls this "healthy-volunteer bias." The quieter name for it is the sieve.',
          'The polite word for this in the methods section is "selection bias." The honest word is preselection — the sieve runs before the study begins, and the study only ever measures what the sieve lets through. A heritability of 0.40 on Biobank neuroticism is not wrong. It is a precise, defensible number about a sample of volunteers. What it is not is a number about the species. The distinction is methodological and it is also moral; statements about human nature tend to get written as if they applied to humans.',
          'Preselection in this field is not new. Francis Galton, the Victorian statistician who founded behavioral genetics, recruited his subjects from the educated professional classes of Kensington because those were the people he knew how to reach. A century later Cyril Burt\'s twin-study ascertainment, never fully documented and still contested, seeded the field with numbers whose provenance could not be audited. Modern behavioral genetics inherited those habits and, to its credit, has been slowly replacing them with pre-registered protocols, published recruitment trees, and open data. The habits are not gone. They are now named.',
        ],
      },
      {
        heading: 'THE WILLING TWIN',
        headingJp: '応じる双子',
        paragraphs: [
          'The twin study is the jewel of the field and the oldest, cleanest instrument behavioral genetics owns. Compare identical twins to fraternal twins on a trait; the gap between the correlations, roughly, is the additive genetic contribution. The Scandinavian registries — Swedish, Danish, Finnish — come closer than any other resource on earth to enrolling the full population of twins. They are the gold standard. They still preselect.',
          'The twins who enroll are the twins who can be reached, who are alive, who remain in contact with each other, who return the questionnaire. Twins estranged from their co-twin drop out. Twins whose co-twin has died drop out. Twins whose co-twin has a severe psychiatric condition drop out at elevated rates, because severe illness correlates with disengagement from research. The concordance figure that results is the concordance among twins close enough to both be in the registry at the same time. A trait whose expression drives twins apart will show a lower concordance than the underlying genetics implies, and the field has no clean way of correcting for this.',
          'The reared-apart twin studies — Bouchard\'s Minnesota cohort from the 1980s is the canonical example — were methodologically brilliant and ascertainment-fragile in ways that still provoke argument. Twins who were adopted apart, found each other, agreed to travel to Minneapolis, and consented to a week of testing are a vanishing sliver of possible adoptees. Their very existence as a study sample is a selected outcome. The famous heritability numbers that came out of Minnesota — intelligence around 0.70, personality around 0.50 — are among the most-cited in the field. They are also among the most honestly qualified, in the original papers, by acknowledgments of how the sample was assembled.',
          'None of this invalidates twin studies. It does mean that the single number produced — 0.60 heritable, 0.20 shared environment, 0.20 unique environment — is a summary of a quiet negotiation between what the trait is and who the trait lets you enroll. The ACE model that decomposes those three components assumes no assortative mating, no gene-environment correlation, no gene-environment interaction. Every one of those assumptions is wrong in minor ways and sometimes wrong in major ways. The cleanest instrument still has a sieve upstream of it.',
        ],
      },
      {
        heading: 'THE HONEST SELF-REPORT',
        headingJp: '自己申告の限界',
        paragraphs: [
          'Most behavioral traits are measured by asking people about themselves. A five-factor personality inventory, a depression screener, a substance-use questionnaire — these instruments assume a respondent with a stable enough sense of self to answer, a literate enough reader to parse the question, and a motivated enough participant to answer honestly across two hundred items. Each of those assumptions is a filter. Each filter removes a non-random slice of the population.',
          'Depression is the canonical example. Severe depression lowers the probability of completing a depression questionnaire. The people whose depression is worst are the people least likely to be measured, which means the distribution of "depression" in a research dataset is truncated on the side that matters most. Heritability of self-reported depression is therefore partly the heritability of "willingness and capacity to describe yourself as depressed" — a trait that is real, heritable, and not the same thing as depression. The Dunedin Study, which interviews self, teachers, parents, and peers at every wave since 1972, is the rare longitudinal design that tries to get underneath this; its sample size is a few thousand. The big GWAS datasets rely on self-report alone because that is what scales.',
          'Self-report also assumes a stable signifier — that "neurotic" or "conscientious" means the same thing across respondents. Psychometric research has pushed back on this for decades. Measurement invariance tests ask whether the items of a scale are operating the same way across subgroups; they often find they are not. The "openness" of a 22-year-old and the "openness" of a 68-year-old are not the same latent trait dressed in the same words, and when heritability is computed across an age-mixed sample, the resulting number is partly a measurement artifact. Researchers who spend their careers on this problem — Roberts, Soto, the Big Five psychometricians — have been flagging it in the literature for years. It is slow to filter downstream into applied GWAS work.',
          'The language of the field has quietly absorbed this. Papers now distinguish "broad depression" (endorsed one item on a phone-based screener) from "strict depression" (met DSM criteria in a clinical interview). The genetic correlation between the two is high but not one. They are related traits. They are not the same trait. One of them is what self-report can find; the other is what the clinic can find. Between them falls the population neither caught.',
        ],
      },
      {
        heading: 'WHAT ANCESTRY FILTERS',
        headingJp: '祖先というフィルター',
        paragraphs: [
          'The most consequential preselection in modern behavioral genetics is ancestry. As of the mid-2020s, roughly 86 percent of participants in published genome-wide association studies were of European ancestry. East Asian ancestry accounted for about 10 percent; African ancestry for about 2 percent; every other global population shared the remaining sliver. A polygenic score trained on this evidence base predicts a European-ancestry outcome with reasonable skill and loses something like seventy percent of its predictive power when applied to people of African descent. Martin and colleagues documented this cleanly in 2019 (Nature Genetics); the result has been replicated many times since. This is not a finding about biology. It is a finding about the enrollment funnel.',
          'The reasons are sociological as much as scientific. The first large biobanks were built in countries with majority-European populations and recruitment channels that favored trusting, research-adjacent communities. Those channels have not historically been open to populations with legitimate reasons to distrust medical research — the Tuskegee syphilis study, the Havasupai diabetes case, the long postcolonial history of bodies studied without consent are not abstractions to the communities that lived them. The field is aware of this and has been investing in cohorts like All of Us, H3Africa, and BioMe to broaden the base, but parity is a decade off at the earliest, and the polygenic scores being deployed today — including those sold to consumers through direct-to-consumer genomics companies — are trained on what exists now, not on what is coming.',
          'The technical consequences compound. Linkage disequilibrium patterns differ across ancestries; a variant tagged in Europeans may not be tagged at all in another population because the local haplotype structure is different. Allele frequencies differ; a variant common enough to power a European GWAS may be too rare elsewhere to detect with any sample size currently achievable. The translation of a European polygenic score to a non-European individual is not a simple scaling problem. It is an extrapolation across population-genetic terrain the original study never mapped.',
          'The honest framing is that the current genetics of behavior is not the genetics of human behavior. It is the genetics of human behavior in people whose ancestors are overrepresented in research datasets, which is a more specific and much smaller claim. The work to make the claim general is ahead of the field, not behind it.',
        ],
      },
      {
        heading: 'THE CLINIC ISN\u2019T THE WORLD',
        headingJp: '病院の外',
        paragraphs: [
          'The alternative to population-based recruitment is clinical ascertainment — study the people the healthcare system has already identified as having the condition. This solves some problems and creates others. A schizophrenia genetics study recruited from inpatient units will find severe, treatment-contact cases and miss the population with attenuated psychotic symptoms who never see a psychiatrist. A bipolar study through specialist clinics oversamples the well-resourced patients who made it into specialty care and undersamples the patients who cycle through emergency rooms and primary care without ever reaching a diagnosis that sticks.',
          'Every diagnostic label is itself a sieve, upstream of the genetic study. Who gets diagnosed with ADHD, who gets diagnosed with autism, who gets diagnosed with personality disorder — these are questions answered in part by biology and in part by which clinician saw which child in which school district with which insurance. A GWAS of "diagnosed ADHD" is a GWAS of the disposition to receive that diagnosis, which includes genuine neurobiology and also includes the social sieve that routed particular children toward particular clinicians. The two contributions are confounded in the resulting summary statistics, and no analytic technique currently pulls them apart cleanly.',
          'Clinical trials have their own ascertainment. STAR*D, the largest US depression treatment trial, recruited patients who were willing to be randomized into a stepped-care protocol; its response rates and side-effect profiles are indispensable, and they describe a specific slice of depressed Americans — mostly insured, mostly primary-care-reached, mostly willing to tolerate a research protocol on top of a clinical one. The generalizations from STAR*D to "depression" in general are routine in the literature and routinely too broad. Treatment studies, like genetic studies, describe the population they managed to recruit.',
          'The field\u2019s best response is triangulation — combine clinical and population samples, compare polygenic predictions across settings, flag when the two diverge. What the field cannot do is pretend either sieve is neutral. Both are loaded. They are loaded differently, and the honest report names which loading produced which number.',
        ],
      },
      {
        heading: 'PARTICIPATION AS PHENOTYPE',
        headingJp: '参加することの遺伝性',
        paragraphs: [
          'The strangest finding in the literature on preselection is the one that turns the problem on its head. In 2021, Pirastu and colleagues published a paper (Nature Genetics) showing that participation in research is itself a heritable trait. They ran genome-wide association studies on completion of follow-up surveys inside the UK Biobank, on return of mail-in questionnaires inside the Avon Longitudinal Study, on willingness to wear an accelerometer for a week. They found robust, replicable genetic signal for all of it. The willingness to fill out forms is, to a modest but measurable degree, in the genes.',
          'That finding would be a curiosity if it ended there. It does not. Participation is genetically correlated with the traits the field studies — higher body mass, lower cognitive-test performance, more psychiatric symptomatology are all associated, genetically, with lower participation. This means that when a GWAS of, say, depression is run inside a cohort, the variants that push people toward depression are the same variants that pushed some would-be participants out of the cohort before they could be measured. The ascertainment bias is not just demographic. It is at the level of the allele.',
          'The practical consequence is that conventional GWAS summary statistics on behavioral traits are biased estimators of the genetic architecture of those traits, and the bias is in the same direction as the trait itself. This is a harder problem than the ancestry problem. The ancestry problem can be addressed by recruiting more diverse cohorts; the participation problem cannot be solved by recruiting, because the people who are not participating are, by definition, not there to recruit. The methodological fix is to model participation as a latent trait alongside the one you care about, using whatever auxiliary data you have about non-responders — a technique still being refined, still controversial, and not yet standard.',
          'The deeper point is philosophical. Every behavioral-genetics finding is a claim about a trait as expressed in a sample that was willing to be measured for that trait. The measurement process is not external to the phenomenon. It is part of the phenomenon. This is a discomfiting thing to tell a field built on the premise that the measurement and the trait are separable.',
        ],
      },
      {
        heading: 'THE MISSING HERITABILITY',
        headingJp: '見えない遺伝率',
        paragraphs: [
          'For a decade after the first GWAS wave of 2007, the field talked openly about a puzzle it called "the missing heritability." Twin studies had estimated the heritability of adult height at around 0.80 — remarkably stable across cohorts, across decades, across populations. Early GWAS, with their few hundred genome-wide-significant variants, could account for only a few percent of the variance. A gap of seventy percentage points sat between the twin number and the molecular number. The gap was named in a 2008 editorial (Maher, Nature), formalized in a 2009 review (Manolio et al., Nature), and spent the next fifteen years being chipped away at from both sides.',
          'The molecular side has closed most of the gap for simple traits. Height is now about 0.40–0.50 by GWAS — the remainder chalked up to rare variants, structural variation, and better methods for capturing common-variant tagging (Yang, Visscher, and collaborators). For behavioral traits the gap is still enormous. Educational attainment, one of the most heavily studied behavioral outcomes, shows a twin-study heritability near 0.40 and a GWAS-estimated SNP-heritability around 0.12 once you restrict to populations where the estimates are meaningful. The arithmetic of the missing heritability has always been phrased as if the twin number were true and the GWAS number were incomplete. The preselection literature suggests the error bars run in both directions.',
          'Twin-study heritability is inflated when assortative mating is present — when partners resemble each other on the trait, which they do for education and cognitive measures. The ACE decomposition assigns that resemblance to shared genes rather than to non-random mating, and the shared-genes estimate goes up. GWAS heritability is deflated by ancestry restriction, by self-report truncation, by the Pirastu participation effect, and by the fact that the cohorts doing the measuring are not samples of humans in the way the math assumes. The gap between the two numbers is not a single underestimate. It is a pair of biased estimators pointing at the same latent quantity from different directions, and the truth — if "the heritability" is even a well-defined quantity — is somewhere in a region neither arrow is currently reaching.',
          'This is not a crisis. It is the field doing the work. But it is worth naming what the work actually is. Heritability is not a property of a trait. It is a property of a population measured in a particular way under particular conditions. Different sieves produce different numbers. None of them is the number.',
        ],
      },
      {
        heading: 'WHAT ESCAPES THE SIEVE',
        headingJp: '網からこぼれるもの',
        paragraphs: [
          'What escapes the sieve is not random. That is the one sentence worth taking from this issue. The people who do not enroll in biobanks, who do not respond to surveys, who lost touch with their twin, whose ancestry is underrepresented, who never reached the clinic, whose genotypes predispose them to opt out of the forms — they are structured populations, not noise, and the traits that caused them to fall through are often the traits the study was trying to measure. A behavioral-genetics result computed on the surviving sample will be biased in a direction the methods section rarely names.',
          'Eric Turkheimer — one of the clearest-eyed writers the field has — has argued for twenty years that heritability is nearly universal (his "first law"), nearly uninformative about mechanism (a corollary), and almost always smaller, in its useful causal sense, than the number seems to imply. He is not a critic from the outside. He is a behavioral geneticist making the field honest about what its numbers can do. The preselection story is one more reason to read him closely. The number is real. The number is not what it looks like. These can both be true.',
          'The correction is not to stop doing the science. The science has produced real, replicable, useful findings about human variation, and stopping would be a loss. The correction is to publish the sieve alongside the number — who was invited, who said yes, who completed, who dropped out, whose ancestry is represented, whose is not, and what the evidence suggests about how those stages depend on the trait under study. A few of the better-run cohorts are beginning to do this. Most still do not. The field would be more honest, and the findings more durable, if every heritability estimate came stapled to its ascertainment narrative.',
          'A last observation, from a magazine not usually in the methods business: every study of humans begins with the decision of who gets studied, and that decision is almost never neutral. This is true of behavioral genetics. It is also true of the design research that informs the software on your desk, the consumer surveys that set your product roadmap, the academic ethnographies that get written into the next round of tools, the magazine subscriptions that define the audience a magazine believes it is writing for. kernel.chat, it should be said, studies coders who read magazines about coders. The sieve is always there. Naming it does not close it. Not naming it guarantees the wrong story gets told.',
        ],
      },
    ],

    pullQuote: {
      text: 'Every heritability number is a statement about a sample. The sample is never the species.',
      attribution: 'KERNEL.CHAT \u00b7 EDITORIAL',
    },

    /** Opening register — editorial dossier card. Sits between
        the essay head and the first section, introducing the
        subject the way a fashion magazine would: numbered,
        catalog-typeset, the issue's frame before the prose. */
    dossier: {
      kicker: 'THE REGISTER \u00b7 \u8981\u7db1',
      note: 'The frame of the issue, laid out the way a magazine lays out its subject before the essay begins.',
      items: [
        {
          label: 'Subject',
          labelJp: '\u4e3b\u984c',
          value: 'Preselection in behavioral genetics \u2014 the decision of who gets studied, made before any study begins.',
        },
        {
          label: 'Field',
          labelJp: '\u5206\u91ce',
          value: 'Human behavior genetics, from Galton\u2019s 1869 \u201cHereditary Genius\u201d to the biobank era.',
        },
        {
          label: 'Instruments',
          labelJp: '\u9053\u5177',
          value: 'Twin registries, population biobanks, genome-wide association studies, polygenic scores.',
        },
        {
          label: 'The sample',
          labelJp: '\u6a19\u672c',
          value: '5.5 percent of those invited to the UK Biobank. 86 percent of GWAS participants of European ancestry. A sliver of the species that said yes.',
        },
        {
          label: 'The hidden variable',
          labelJp: '\u96a0\u308c\u305f\u5909\u6570',
          value: 'The people who declined. Structured, non-random, correlated with the traits the field tries to measure.',
        },
        {
          label: 'The quiet claim',
          labelJp: '\u9759\u304b\u306a\u4e3b\u5f35',
          value: 'Every heritability number is a statement about a sample. The sample is never the species.',
        },
      ],
    },

    /** The Figures — editorial "by-the-numbers" block. Placed
        after the clinic section (index 4) so it lands between
        the five methodological sections and the two newer
        structural ones (participation, missing heritability). */
    dataBlock: {
      kicker: 'THE FIGURES \u00b7 \u6570\u5b57',
      heading: 'The sieve, in six statistics.',
      headingJp: '\u7db2\u306b\u6b8b\u3063\u305f\u3082\u306e\u3001\u516d\u3064\u306e\u6570\u5b57\u3067\u3002',
      afterSection: 4,
      stats: [
        {
          n: '5.5%',
          label: 'of invited UK residents returned the UK Biobank consent and completed baseline enrollment. The rest, by definition, are not in the dataset.',
          source: 'UK Biobank recruitment, 2006\u20132010',
        },
        {
          n: '86%',
          label: 'of participants in published genome-wide association studies were of European ancestry at the last audit. The remaining 14 percent carry the weight of every non-European claim the field makes.',
          source: 'GWAS diversity audit, mid-2020s',
        },
        {
          n: '\u221270%',
          label: 'predictive power lost when a polygenic score trained on European-ancestry participants is applied to individuals of African descent. A sampling artifact, not a biological one.',
          source: 'Martin et al., Nat Genet 2019',
        },
        {
          n: '0.40 \u2192 0.12',
          label: 'twin-study heritability of educational attainment, versus GWAS SNP-heritability of the same trait. The gap is the field\u2019s oldest unresolved debt.',
          source: 'Manolio et al., Nat 2009',
        },
        {
          n: 'h\u00b2 > 0',
          label: 'heritability of research participation itself \u2014 willingness to complete the survey is in the genes, and the variants correlate with the traits the surveys try to measure.',
          source: 'Pirastu et al., Nat Genet 2021',
        },
        {
          n: '1869',
          label: 'year Galton published \u201cHereditary Genius\u201d and recruited his subjects from the educated professional classes of Kensington. The sieve began here.',
          source: 'Galton, \u201cHereditary Genius,\u201d 1869',
        },
      ],
    },

    /** Further reading — editorial back matter. Named studies
        with one-line editorial glosses. Colophon-adjacent, not
        footnote-adjacent; the magazine tells you where to keep
        reading, it does not impersonate a reference manager. */
    references: {
      kicker: 'FURTHER \u00b7 \u53c2\u8003',
      note: 'Selected reading, in the order the essay touches them. One-line editorial notes, not citations.',
      items: [
        {
          authors: 'Galton, F.',
          year: '1869',
          title: 'Hereditary Genius',
          journal: 'Macmillan \u2014 the founding document of the field, and the first preselected sample',
        },
        {
          authors: 'Bouchard, T. J. et al.',
          year: '1990',
          title: 'Sources of human psychological differences: the Minnesota study of twins reared apart',
          journal: 'Science \u2014 the reared-apart study whose methods still provoke argument',
        },
        {
          authors: 'Maher, B.',
          year: '2008',
          title: 'Personal genomes: the case of the missing heritability',
          journal: 'Nature \u2014 the editorial that named the gap',
        },
        {
          authors: 'Manolio, T. A. et al.',
          year: '2009',
          title: 'Finding the missing heritability of complex diseases',
          journal: 'Nature \u2014 the formal framing of the problem',
        },
        {
          authors: 'Turkheimer, E.',
          year: '2000',
          title: 'Three laws of behavior genetics and what they mean',
          journal: 'Current Directions in Psychological Science \u2014 the clearest-eyed interpreter the field has',
        },
        {
          authors: 'Martin, A. R. et al.',
          year: '2019',
          title: 'Clinical use of current polygenic risk scores may exacerbate health disparities',
          journal: 'Nature Genetics \u2014 the canonical portability paper',
        },
        {
          authors: 'Pirastu, N. et al.',
          year: '2021',
          title: 'Genetic analyses identify widespread sex-differential participation bias',
          journal: 'Nature Genetics \u2014 participation itself is heritable; the deepest form of preselection yet named',
        },
        {
          authors: 'Yang, J., Visscher, P. M. et al.',
          year: '2010\u2013present',
          title: 'GCTA and successor methods for SNP-heritability estimation',
          journal: 'Various \u2014 the closing arithmetic on the missing-heritability debt',
        },
      ],
    },

    signoff: '\u7814\u7a76\u306e\u524d\u306b \u2014 before the data speaks, the sample has already chosen what it can say.',
  },

  credits: {
    editorInChief: 'Isaac Hernandez',
    creativeDirection: 'kernel.chat group',
    artDirection: 'in-house',
    copy: 'kernel.chat editorial',
    japanese: 'kernel.chat editorial',
    production: 'kernel.chat group',
  },
}
