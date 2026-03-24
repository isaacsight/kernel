import { type UserProfile, type LearningStats } from './learning.js';
export declare function generateInsights(): string;
export declare function generateReflection(): string;
export declare function generateComparison(): string;
export interface ExtendedInsights {
    profile: UserProfile;
    stats: LearningStats;
    patternCount: number;
    knowledgeCount: number;
    correctionCount: number;
    projectCount: number;
    topTask: string | null;
    topAgent: string | null;
    topPattern: string | null;
}
export declare function getExtendedInsights(): ExtendedInsights;
//# sourceMappingURL=introspection.d.ts.map