/**
 * Skill Relationship Graph with Transfer Coefficients
 *
 * Patent Claim: Graph-based skill matching using transfer coefficients
 * derived from course prerequisites, job co-occurrence, and student
 * learning sequences - producing more accurate course recommendations
 * than isolated keyword matching.
 *
 * This implements a simplified Graph Neural Network approach using
 * message-passing to aggregate skill neighborhood information.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export interface SkillNode {
  name: string;
  features?: number[];           // Feature vector for GNN
  neighbors: Map<string, Edge>;  // skill -> edge data
  inDegree: number;              // Number of skills that transfer TO this
  outDegree: number;             // Number of skills this transfers TO
}

export interface Edge {
  target: string;
  coefficient: number;           // Transfer coefficient 0-1
  type: RelationshipType;
  evidence_count: number;
  confidence: number;
}

export type RelationshipType =
  | 'prerequisite'     // Must learn A before B
  | 'corequisite'      // Learn together
  | 'transfers_to'     // A helps learn B
  | 'specialization_of' // A is more specific version of B
  | 'related_to';      // General relationship

export interface SkillGraph {
  nodes: Map<string, SkillNode>;
  edges: Edge[];
  getNode: (name: string) => SkillNode | undefined;
  getTransferScore: (from: string, to: string, maxDepth?: number) => number;
  getRelatedSkills: (skill: string, minCoefficient?: number) => string[];
  getPrerequisites: (skill: string) => string[];
  getSkillsTransferringTo: (skill: string) => Array<{ skill: string; coefficient: number }>;
}

export interface CourseScoreResult {
  total_score: number;           // 0-1 normalized
  raw_score: number;             // Unnormalized
  direct_matches: string[];
  transfer_matches: Array<{
    course_skill: string;
    gap_skill: string;
    coefficient: number;
  }>;
  prerequisite_coverage: number; // % of prereqs covered
  recommendation_reason: string;
}

// ============================================================================
// GRAPH CONSTRUCTION
// ============================================================================

/**
 * Build skill graph from relationship data
 */
export function buildSkillGraph(
  relationships: Array<{
    source_skill: string;
    target_skill: string;
    relationship_type: RelationshipType;
    transfer_coefficient: number;
    evidence_count?: number;
    confidence?: number;
  }>
): SkillGraph {
  const nodes = new Map<string, SkillNode>();
  const edges: Edge[] = [];

  // Build nodes and edges
  for (const rel of relationships) {
    const sourceName = rel.source_skill.toLowerCase();
    const targetName = rel.target_skill.toLowerCase();

    // Create source node if needed
    if (!nodes.has(sourceName)) {
      nodes.set(sourceName, {
        name: sourceName,
        neighbors: new Map(),
        inDegree: 0,
        outDegree: 0,
      });
    }

    // Create target node if needed
    if (!nodes.has(targetName)) {
      nodes.set(targetName, {
        name: targetName,
        neighbors: new Map(),
        inDegree: 0,
        outDegree: 0,
      });
    }

    // Create edge
    const edge: Edge = {
      target: targetName,
      coefficient: rel.transfer_coefficient,
      type: rel.relationship_type,
      evidence_count: rel.evidence_count || 1,
      confidence: rel.confidence || 0.8,
    };

    nodes.get(sourceName)!.neighbors.set(targetName, edge);
    nodes.get(sourceName)!.outDegree++;
    nodes.get(targetName)!.inDegree++;
    edges.push(edge);
  }

  return {
    nodes,
    edges,

    getNode(name: string): SkillNode | undefined {
      return nodes.get(name.toLowerCase());
    },

    /**
     * Calculate transfer score from source to target skill
     * Uses BFS to find best path up to maxDepth
     */
    getTransferScore(from: string, to: string, maxDepth: number = 3): number {
      const source = from.toLowerCase();
      const target = to.toLowerCase();

      if (source === target) return 1.0;

      const visited = new Set<string>();
      const queue: Array<{ skill: string; score: number; depth: number }> = [
        { skill: source, score: 1.0, depth: 0 }
      ];

      let bestScore = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (visited.has(current.skill)) continue;
        visited.add(current.skill);

        if (current.skill === target) {
          bestScore = Math.max(bestScore, current.score);
          continue;
        }

        if (current.depth >= maxDepth) continue;

        const node = nodes.get(current.skill);
        if (!node) continue;

        for (const [neighbor, edge] of node.neighbors) {
          if (!visited.has(neighbor)) {
            queue.push({
              skill: neighbor,
              score: current.score * edge.coefficient,
              depth: current.depth + 1,
            });
          }
        }
      }

      return bestScore;
    },

    /**
     * Get skills related to the given skill
     */
    getRelatedSkills(skill: string, minCoefficient: number = 0.3): string[] {
      const node = nodes.get(skill.toLowerCase());
      if (!node) return [];

      return [...node.neighbors.entries()]
        .filter(([_, edge]) => edge.coefficient >= minCoefficient)
        .map(([name, _]) => name);
    },

    /**
     * Get prerequisites for a skill
     */
    getPrerequisites(skill: string): string[] {
      const prereqs: string[] = [];
      const target = skill.toLowerCase();

      for (const [sourceName, sourceNode] of nodes) {
        const edge = sourceNode.neighbors.get(target);
        if (edge && edge.type === 'prerequisite') {
          prereqs.push(sourceName);
        }
      }

      return prereqs;
    },

    /**
     * Get skills that transfer to the given skill
     */
    getSkillsTransferringTo(skill: string): Array<{ skill: string; coefficient: number }> {
      const result: Array<{ skill: string; coefficient: number }> = [];
      const target = skill.toLowerCase();

      for (const [sourceName, sourceNode] of nodes) {
        const edge = sourceNode.neighbors.get(target);
        if (edge) {
          result.push({
            skill: sourceName,
            coefficient: edge.coefficient,
          });
        }
      }

      return result.sort((a, b) => b.coefficient - a.coefficient);
    },
  };
}

// ============================================================================
// COURSE SCORING WITH TRANSFER
// ============================================================================

/**
 * Score a course against skill gaps using transfer coefficients
 *
 * Unlike keyword matching, this accounts for:
 * - Related skills that transfer learning
 * - Prerequisites that build foundation
 * - Transitive relationships (A→B→C)
 */
export function scoreCourseWithTransfer(
  courseSkills: string[],
  gapSkills: string[],
  graph: SkillGraph,
  options: {
    directMatchWeight?: number;
    transferWeight?: number;
    minTransferThreshold?: number;
  } = {}
): CourseScoreResult {
  const {
    directMatchWeight = 1.0,
    transferWeight = 0.7,
    minTransferThreshold = 0.3,
  } = options;

  const directMatches: string[] = [];
  const transferMatches: CourseScoreResult['transfer_matches'] = [];
  let rawScore = 0;

  const normalizedCourseSkills = courseSkills.map(s => s.toLowerCase());
  const normalizedGaps = gapSkills.map(s => s.toLowerCase());
  const matchedGaps = new Set<string>();

  for (const gap of normalizedGaps) {
    // Check direct match first
    if (normalizedCourseSkills.includes(gap)) {
      directMatches.push(gap);
      rawScore += directMatchWeight;
      matchedGaps.add(gap);
      continue;
    }

    // Check transfer matches
    let bestTransfer = 0;
    let bestCourseSkill = '';

    for (const courseSkill of normalizedCourseSkills) {
      const transfer = graph.getTransferScore(courseSkill, gap);
      if (transfer > bestTransfer && transfer >= minTransferThreshold) {
        bestTransfer = transfer;
        bestCourseSkill = courseSkill;
      }
    }

    if (bestTransfer >= minTransferThreshold) {
      transferMatches.push({
        course_skill: bestCourseSkill,
        gap_skill: gap,
        coefficient: bestTransfer,
      });
      rawScore += transferWeight * bestTransfer;
      matchedGaps.add(gap);
    }
  }

  // Calculate prerequisite coverage
  const coursePrereqs = new Set<string>();
  for (const skill of normalizedCourseSkills) {
    for (const prereq of graph.getPrerequisites(skill)) {
      coursePrereqs.add(prereq);
    }
  }

  const prereqsCoveredByGaps = [...coursePrereqs].filter(p =>
    normalizedGaps.some(g => graph.getTransferScore(g, p) > 0.5)
  );
  const prerequisiteCoverage = coursePrereqs.size > 0
    ? prereqsCoveredByGaps.length / coursePrereqs.size
    : 1.0;

  // Normalize score
  const totalScore = gapSkills.length > 0
    ? rawScore / gapSkills.length
    : 0;

  // Generate recommendation reason
  const reasons: string[] = [];
  if (directMatches.length > 0) {
    reasons.push(`Directly teaches ${directMatches.length} gap skill(s)`);
  }
  if (transferMatches.length > 0) {
    reasons.push(`Builds foundation for ${transferMatches.length} skill(s) through transfer`);
  }
  if (prerequisiteCoverage < 0.5) {
    reasons.push(`Note: Some prerequisites may be missing`);
  }

  return {
    total_score: Math.min(1, totalScore),
    raw_score: rawScore,
    direct_matches: directMatches,
    transfer_matches: transferMatches,
    prerequisite_coverage: prerequisiteCoverage,
    recommendation_reason: reasons.join('. ') || 'Limited skill alignment',
  };
}

// ============================================================================
// MESSAGE PASSING (GNN-like aggregation)
// ============================================================================

/**
 * Perform message-passing aggregation over the skill graph
 *
 * Each node aggregates information from its neighbors, weighted by
 * transfer coefficients. After K rounds, each node's representation
 * encodes its K-hop neighborhood.
 */
export function aggregateNeighborFeatures(
  graph: SkillGraph,
  nodeFeatures: Map<string, number[]>,
  rounds: number = 2,
  aggregation: 'mean' | 'max' | 'sum' = 'mean'
): Map<string, number[]> {
  if (nodeFeatures.size === 0) return new Map();

  // Get feature dimension from first entry
  const firstFeatures = nodeFeatures.values().next().value;
  if (!firstFeatures) return new Map();
  const dim = firstFeatures.length;

  let currentFeatures = new Map(nodeFeatures);

  for (let round = 0; round < rounds; round++) {
    const nextFeatures = new Map<string, number[]>();

    for (const [name, node] of graph.nodes) {
      const selfFeature = currentFeatures.get(name) || new Array(dim).fill(0);
      const neighborFeatures: number[][] = [];
      const neighborWeights: number[] = [];

      for (const [neighbor, edge] of node.neighbors) {
        const nf = currentFeatures.get(neighbor);
        if (nf) {
          neighborFeatures.push(nf);
          neighborWeights.push(edge.coefficient);
        }
      }

      // Aggregate based on method
      let aggregated: number[];

      switch (aggregation) {
        case 'max':
          aggregated = selfFeature.map((v, i) => {
            const neighborVals = neighborFeatures.map(f => f[i] * neighborWeights[neighborFeatures.indexOf(f)]);
            return Math.max(v, ...neighborVals);
          });
          break;

        case 'sum':
          aggregated = selfFeature.slice();
          for (let j = 0; j < neighborFeatures.length; j++) {
            for (let i = 0; i < dim; i++) {
              aggregated[i] += neighborFeatures[j][i] * neighborWeights[j];
            }
          }
          break;

        case 'mean':
        default:
          aggregated = selfFeature.slice();
          let totalWeight = 1.0;
          for (let j = 0; j < neighborFeatures.length; j++) {
            for (let i = 0; i < dim; i++) {
              aggregated[i] += neighborFeatures[j][i] * neighborWeights[j];
            }
            totalWeight += neighborWeights[j];
          }
          aggregated = aggregated.map(v => v / totalWeight);
          break;
      }

      nextFeatures.set(name, aggregated);
    }

    currentFeatures = nextFeatures;
  }

  return currentFeatures;
}

// ============================================================================
// DATABASE INTEGRATION
// ============================================================================

/**
 * Load skill relationships from database
 */
export async function loadSkillGraph(
  supabase: SupabaseClient
): Promise<SkillGraph> {
  const { data, error } = await supabase
    .from('skill_relationships')
    .select('source_skill, target_skill, relationship_type, transfer_coefficient, evidence_count, confidence');

  if (error) {
    console.error('[SkillGraph] Failed to load relationships:', error.message);
    return buildSkillGraph([]);
  }

  return buildSkillGraph(data || []);
}

/**
 * Add or update a skill relationship
 */
export async function upsertSkillRelationship(
  supabase: SupabaseClient,
  relationship: {
    source_skill: string;
    target_skill: string;
    relationship_type: RelationshipType;
    transfer_coefficient: number;
    evidence_source?: string;
    confidence?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('skill_relationships')
    .upsert({
      source_skill: relationship.source_skill.toLowerCase(),
      target_skill: relationship.target_skill.toLowerCase(),
      relationship_type: relationship.relationship_type,
      transfer_coefficient: relationship.transfer_coefficient,
      evidence_source: relationship.evidence_source || 'manual',
      confidence: relationship.confidence || 0.8,
      evidence_count: 1,
    }, {
      onConflict: 'source_skill,target_skill,relationship_type',
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Increment evidence count for existing relationship
 */
export async function incrementRelationshipEvidence(
  supabase: SupabaseClient,
  sourceSkill: string,
  targetSkill: string,
  relationshipType: RelationshipType
): Promise<void> {
  await supabase.rpc('increment_relationship_evidence', {
    p_source: sourceSkill.toLowerCase(),
    p_target: targetSkill.toLowerCase(),
    p_type: relationshipType,
  });
}

// ============================================================================
// SKILL GRAPH ANALYTICS
// ============================================================================

export interface GraphAnalytics {
  total_nodes: number;
  total_edges: number;
  avg_out_degree: number;
  most_connected_skills: Array<{ skill: string; connections: number }>;
  isolated_skills: string[];
  strongest_transfers: Array<{
    from: string;
    to: string;
    coefficient: number;
  }>;
}

/**
 * Analyze skill graph structure
 */
export function analyzeGraph(graph: SkillGraph): GraphAnalytics {
  const nodes = [...graph.nodes.values()];

  const totalOutDegree = nodes.reduce((sum, n) => sum + n.outDegree, 0);
  const avgOutDegree = nodes.length > 0 ? totalOutDegree / nodes.length : 0;

  const sortedByConnections = nodes
    .map(n => ({ skill: n.name, connections: n.outDegree + n.inDegree }))
    .sort((a, b) => b.connections - a.connections);

  const isolated = nodes
    .filter(n => n.outDegree === 0 && n.inDegree === 0)
    .map(n => n.name);

  const allEdges: Array<{ from: string; to: string; coefficient: number }> = [];
  for (const [sourceName, node] of graph.nodes) {
    for (const [targetName, edge] of node.neighbors) {
      allEdges.push({
        from: sourceName,
        to: targetName,
        coefficient: edge.coefficient,
      });
    }
  }
  allEdges.sort((a, b) => b.coefficient - a.coefficient);

  return {
    total_nodes: nodes.length,
    total_edges: graph.edges.length,
    avg_out_degree: avgOutDegree,
    most_connected_skills: sortedByConnections.slice(0, 10),
    isolated_skills: isolated,
    strongest_transfers: allEdges.slice(0, 10),
  };
}
