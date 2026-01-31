/**
 * NSGA-II Multi-Objective Course Selection Optimizer
 *
 * Patent Claims:
 * 1. Pareto-optimal learning path generation
 * 2. Multi-objective optimization: minimize time, maximize coverage, respect prerequisites
 * 3. Customized genetic operators for course sequences
 *
 * Unlike greedy selection, NSGA-II finds the entire Pareto front of
 * non-dominated solutions, allowing users to choose their preferred
 * tradeoff between learning time and skill coverage.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Course {
  id: string;
  title: string;
  skills_taught: string[];
  duration_hours: number;
  prerequisites: string[];
  cost_usd: number;
  provider?: string;
  rating?: number;
}

export interface LearningPath {
  courses: Course[];
  total_hours: number;
  total_cost: number;
  skills_covered: string[];
  gaps_remaining: string[];
  prerequisite_violations: number;
  coverage_percentage: number;
}

export interface OptimizationResult {
  pareto_front: LearningPath[];
  recommended: LearningPath;     // Balanced solution
  fastest: LearningPath;          // Minimum time
  most_comprehensive: LearningPath; // Maximum coverage
  cheapest: LearningPath;         // Minimum cost
  optimization_stats: {
    generations: number;
    population_size: number;
    pareto_size: number;
    execution_time_ms: number;
  };
}

interface Individual {
  chromosome: string[];         // Course IDs in order
  objectives: number[];         // [time, uncovered_gaps, violations, cost]
  rank: number;                 // Pareto rank (0 = best)
  crowding_distance: number;    // Diversity measure
}

// ============================================================================
// NSGA-II MAIN ALGORITHM
// ============================================================================

/**
 * NSGA-II Multi-Objective Optimization for Learning Paths
 *
 * Optimizes simultaneously for:
 * 1. Minimize total time
 * 2. Minimize remaining skill gaps (maximize coverage)
 * 3. Minimize prerequisite violations
 * 4. Minimize cost (optional)
 */
export function optimizeLearningPath(
  availableCourses: Course[],
  skillGaps: string[],
  options: {
    maxHours?: number;
    maxCost?: number;
    populationSize?: number;
    generations?: number;
    mutationRate?: number;
    crossoverRate?: number;
    includeCost?: boolean;
  } = {}
): OptimizationResult {
  const startTime = Date.now();

  const {
    maxHours = 200,
    maxCost = 10000,
    populationSize = 100,
    generations = 50,
    mutationRate = 0.1,
    crossoverRate = 0.8,
    includeCost = false,
  } = options;

  const courseMap = new Map(availableCourses.map(c => [c.id, c]));
  const normalizedGaps = skillGaps.map(g => g.toLowerCase());

  // Initialize population
  let population = initializePopulation(
    availableCourses,
    normalizedGaps,
    populationSize
  );

  // Evaluate initial population
  population = evaluatePopulation(population, courseMap, normalizedGaps, maxHours, maxCost, includeCost);

  // Main evolution loop
  for (let gen = 0; gen < generations; gen++) {
    // Create offspring through selection, crossover, mutation
    const offspring = createOffspring(
      population,
      availableCourses,
      crossoverRate,
      mutationRate
    );

    // Evaluate offspring
    const evaluatedOffspring = evaluatePopulation(
      offspring,
      courseMap,
      normalizedGaps,
      maxHours,
      maxCost,
      includeCost
    );

    // Combine parent and offspring
    const combined = [...population, ...evaluatedOffspring];

    // Non-dominated sorting
    const fronts = nonDominatedSort(combined);

    // Select next generation
    population = selectNextGeneration(fronts, populationSize);
  }

  // Extract results
  const paretoFront = population
    .filter(ind => ind.rank === 0)
    .map(ind => buildLearningPath(ind.chromosome, courseMap, normalizedGaps));

  // Find special solutions
  const recommended = findBalancedSolution(paretoFront);
  const fastest = findFastestSolution(paretoFront);
  const mostComprehensive = findMostComprehensiveSolution(paretoFront);
  const cheapest = findCheapestSolution(paretoFront);

  const executionTime = Date.now() - startTime;

  return {
    pareto_front: paretoFront,
    recommended,
    fastest,
    most_comprehensive: mostComprehensive,
    cheapest,
    optimization_stats: {
      generations,
      population_size: populationSize,
      pareto_size: paretoFront.length,
      execution_time_ms: executionTime,
    },
  };
}

// ============================================================================
// POPULATION INITIALIZATION
// ============================================================================

function initializePopulation(
  courses: Course[],
  gaps: string[],
  size: number
): Individual[] {
  const population: Individual[] = [];

  for (let i = 0; i < size; i++) {
    // Random subset of courses (1 to 10)
    const numCourses = Math.floor(Math.random() * Math.min(10, courses.length)) + 1;
    const shuffled = [...courses].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, numCourses).map(c => c.id);

    population.push({
      chromosome: selected,
      objectives: [],
      rank: 0,
      crowding_distance: 0,
    });
  }

  // Add some "smart" individuals targeting specific gaps
  const gapTargeted = Math.min(10, Math.floor(size * 0.1));
  for (let i = 0; i < gapTargeted && i < population.length; i++) {
    const targetGap = gaps[i % gaps.length];
    const relevantCourses = courses
      .filter(c => c.skills_taught.some(s => s.toLowerCase().includes(targetGap) || targetGap.includes(s.toLowerCase())))
      .slice(0, 3)
      .map(c => c.id);

    if (relevantCourses.length > 0) {
      population[i].chromosome = relevantCourses;
    }
  }

  return population;
}

// ============================================================================
// EVALUATION
// ============================================================================

function evaluatePopulation(
  population: Individual[],
  courseMap: Map<string, Course>,
  gaps: string[],
  maxHours: number,
  maxCost: number,
  includeCost: boolean
): Individual[] {
  return population.map(ind => {
    const path = buildLearningPath(ind.chromosome, courseMap, gaps);

    // Objective 1: Minimize time (normalized)
    const timeObj = Math.min(1, path.total_hours / maxHours);

    // Objective 2: Minimize uncovered gaps (normalized)
    const gapObj = gaps.length > 0 ? path.gaps_remaining.length / gaps.length : 0;

    // Objective 3: Minimize prerequisite violations (normalized)
    const violationObj = Math.min(1, path.prerequisite_violations / Math.max(ind.chromosome.length, 1));

    // Objective 4: Minimize cost (optional, normalized)
    const costObj = includeCost ? Math.min(1, path.total_cost / maxCost) : 0;

    const objectives = includeCost
      ? [timeObj, gapObj, violationObj, costObj]
      : [timeObj, gapObj, violationObj];

    return { ...ind, objectives };
  });
}

function buildLearningPath(
  courseIds: string[],
  courseMap: Map<string, Course>,
  gaps: string[]
): LearningPath {
  const courses = courseIds
    .map(id => courseMap.get(id))
    .filter((c): c is Course => c !== undefined);

  // Calculate skills covered
  const skillsCovered = new Set<string>();
  courses.forEach(c =>
    c.skills_taught.forEach(s => skillsCovered.add(s.toLowerCase()))
  );

  // Calculate remaining gaps
  const gapsRemaining = gaps.filter(g => !skillsCovered.has(g));

  // Count prerequisite violations
  let violations = 0;
  const learnedSoFar = new Set<string>();
  for (const course of courses) {
    for (const prereq of course.prerequisites) {
      const prereqLower = prereq.toLowerCase();
      const hasPrereq = [...learnedSoFar].some(s =>
        s.includes(prereqLower) || prereqLower.includes(s)
      );
      if (!hasPrereq) {
        violations++;
      }
    }
    course.skills_taught.forEach(s => learnedSoFar.add(s.toLowerCase()));
  }

  const totalHours = courses.reduce((sum, c) => sum + c.duration_hours, 0);
  const totalCost = courses.reduce((sum, c) => sum + c.cost_usd, 0);
  const coveragePercentage = gaps.length > 0
    ? ((gaps.length - gapsRemaining.length) / gaps.length) * 100
    : 100;

  return {
    courses,
    total_hours: totalHours,
    total_cost: totalCost,
    skills_covered: [...skillsCovered],
    gaps_remaining: gapsRemaining,
    prerequisite_violations: violations,
    coverage_percentage: coveragePercentage,
  };
}

// ============================================================================
// NON-DOMINATED SORTING
// ============================================================================

function dominates(a: Individual, b: Individual): boolean {
  let dominated = false;
  for (let i = 0; i < a.objectives.length; i++) {
    if (a.objectives[i] > b.objectives[i]) return false;
    if (a.objectives[i] < b.objectives[i]) dominated = true;
  }
  return dominated;
}

function nonDominatedSort(population: Individual[]): Individual[][] {
  const fronts: Individual[][] = [[]];
  const dominationCount = new Map<Individual, number>();
  const dominatedSet = new Map<Individual, Individual[]>();

  for (const p of population) {
    dominationCount.set(p, 0);
    dominatedSet.set(p, []);

    for (const q of population) {
      if (p === q) continue;

      if (dominates(p, q)) {
        dominatedSet.get(p)!.push(q);
      } else if (dominates(q, p)) {
        dominationCount.set(p, dominationCount.get(p)! + 1);
      }
    }

    if (dominationCount.get(p) === 0) {
      p.rank = 0;
      fronts[0].push(p);
    }
  }

  let i = 0;
  while (fronts[i].length > 0) {
    const nextFront: Individual[] = [];

    for (const p of fronts[i]) {
      for (const q of dominatedSet.get(p)!) {
        const count = dominationCount.get(q)! - 1;
        dominationCount.set(q, count);

        if (count === 0) {
          q.rank = i + 1;
          nextFront.push(q);
        }
      }
    }

    i++;
    if (nextFront.length > 0) {
      fronts.push(nextFront);
    }
  }

  return fronts;
}

// ============================================================================
// SELECTION
// ============================================================================

function selectNextGeneration(fronts: Individual[][], size: number): Individual[] {
  const next: Individual[] = [];

  for (const front of fronts) {
    if (next.length + front.length <= size) {
      next.push(...front);
    } else {
      // Need to select subset based on crowding distance
      const withDistance = calculateCrowdingDistance(front);
      withDistance.sort((a, b) => b.crowding_distance - a.crowding_distance);
      next.push(...withDistance.slice(0, size - next.length));
      break;
    }
  }

  return next;
}

function calculateCrowdingDistance(front: Individual[]): Individual[] {
  if (front.length <= 2) {
    return front.map(ind => ({ ...ind, crowding_distance: Infinity }));
  }

  const numObjectives = front[0].objectives.length;
  front.forEach(ind => { ind.crowding_distance = 0; });

  for (let m = 0; m < numObjectives; m++) {
    // Sort by this objective
    front.sort((a, b) => a.objectives[m] - b.objectives[m]);

    // Boundary points get infinite distance
    front[0].crowding_distance = Infinity;
    front[front.length - 1].crowding_distance = Infinity;

    const range = front[front.length - 1].objectives[m] - front[0].objectives[m];
    if (range === 0) continue;

    // Interior points
    for (let i = 1; i < front.length - 1; i++) {
      front[i].crowding_distance +=
        (front[i + 1].objectives[m] - front[i - 1].objectives[m]) / range;
    }
  }

  return front;
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

function createOffspring(
  population: Individual[],
  allCourses: Course[],
  crossoverRate: number,
  mutationRate: number
): Individual[] {
  const offspring: Individual[] = [];

  while (offspring.length < population.length) {
    // Tournament selection
    const parent1 = tournamentSelect(population);
    const parent2 = tournamentSelect(population);

    let child: Individual;

    // Crossover
    if (Math.random() < crossoverRate) {
      child = crossover(parent1, parent2);
    } else {
      child = { ...parent1, chromosome: [...parent1.chromosome] };
    }

    // Mutation
    child = mutate(child, allCourses, mutationRate);

    offspring.push(child);
  }

  return offspring;
}

function tournamentSelect(population: Individual[], k: number = 3): Individual {
  const candidates: Individual[] = [];
  for (let i = 0; i < k; i++) {
    candidates.push(population[Math.floor(Math.random() * population.length)]);
  }

  return candidates.reduce((best, curr) => {
    if (curr.rank < best.rank) return curr;
    if (curr.rank === best.rank && curr.crowding_distance > best.crowding_distance) return curr;
    return best;
  });
}

function crossover(parent1: Individual, parent2: Individual): Individual {
  // Two-point crossover for course sequences
  const minLen = Math.min(parent1.chromosome.length, parent2.chromosome.length);

  if (minLen < 2) {
    // Single point crossover
    const point = Math.floor(Math.random() * minLen);
    const child = [
      ...parent1.chromosome.slice(0, point),
      ...parent2.chromosome.slice(point),
    ];
    return {
      chromosome: [...new Set(child)], // Remove duplicates
      objectives: [],
      rank: 0,
      crowding_distance: 0,
    };
  }

  const point1 = Math.floor(Math.random() * minLen);
  const point2 = Math.floor(Math.random() * minLen);
  const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];

  const child = [
    ...parent1.chromosome.slice(0, start),
    ...parent2.chromosome.slice(start, end),
    ...parent1.chromosome.slice(end),
  ];

  return {
    chromosome: [...new Set(child)],
    objectives: [],
    rank: 0,
    crowding_distance: 0,
  };
}

function mutate(individual: Individual, allCourses: Course[], rate: number): Individual {
  const chromosome = [...individual.chromosome];

  // Add mutation: add a random course
  if (Math.random() < rate) {
    const available = allCourses.filter(c => !chromosome.includes(c.id));
    if (available.length > 0) {
      const toAdd = available[Math.floor(Math.random() * available.length)];
      const insertPos = Math.floor(Math.random() * (chromosome.length + 1));
      chromosome.splice(insertPos, 0, toAdd.id);
    }
  }

  // Remove mutation: remove a random course
  if (Math.random() < rate && chromosome.length > 1) {
    const removeIdx = Math.floor(Math.random() * chromosome.length);
    chromosome.splice(removeIdx, 1);
  }

  // Swap mutation: swap two courses
  if (Math.random() < rate && chromosome.length > 1) {
    const i = Math.floor(Math.random() * chromosome.length);
    const j = Math.floor(Math.random() * chromosome.length);
    [chromosome[i], chromosome[j]] = [chromosome[j], chromosome[i]];
  }

  // Replace mutation: replace a course with another
  if (Math.random() < rate / 2 && chromosome.length > 0) {
    const replaceIdx = Math.floor(Math.random() * chromosome.length);
    const available = allCourses.filter(c => !chromosome.includes(c.id));
    if (available.length > 0) {
      const replacement = available[Math.floor(Math.random() * available.length)];
      chromosome[replaceIdx] = replacement.id;
    }
  }

  return {
    ...individual,
    chromosome,
  };
}

// ============================================================================
// SOLUTION SELECTION
// ============================================================================

function findBalancedSolution(front: LearningPath[]): LearningPath {
  if (front.length === 0) {
    return createEmptyPath();
  }

  // Find solution closest to ideal point (normalized objectives)
  const maxHours = Math.max(...front.map(p => p.total_hours), 1);
  const maxGaps = Math.max(...front.map(p => p.gaps_remaining.length), 1);
  const maxViolations = Math.max(...front.map(p => p.prerequisite_violations), 1);

  let best = front[0];
  let bestDistance = Infinity;

  for (const path of front) {
    const timeNorm = path.total_hours / maxHours;
    const gapNorm = path.gaps_remaining.length / maxGaps;
    const violNorm = path.prerequisite_violations / maxViolations;

    // Equal weighting
    const distance = Math.sqrt(timeNorm ** 2 + gapNorm ** 2 + violNorm ** 2);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = path;
    }
  }

  return best;
}

function findFastestSolution(front: LearningPath[]): LearningPath {
  if (front.length === 0) return createEmptyPath();

  return front.reduce((min, curr) =>
    curr.total_hours < min.total_hours ? curr : min
  );
}

function findMostComprehensiveSolution(front: LearningPath[]): LearningPath {
  if (front.length === 0) return createEmptyPath();

  return front.reduce((best, curr) =>
    curr.gaps_remaining.length < best.gaps_remaining.length ? curr : best
  );
}

function findCheapestSolution(front: LearningPath[]): LearningPath {
  if (front.length === 0) return createEmptyPath();

  return front.reduce((min, curr) =>
    curr.total_cost < min.total_cost ? curr : min
  );
}

function createEmptyPath(): LearningPath {
  return {
    courses: [],
    total_hours: 0,
    total_cost: 0,
    skills_covered: [],
    gaps_remaining: [],
    prerequisite_violations: 0,
    coverage_percentage: 0,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format learning path for display
 */
export function formatLearningPath(path: LearningPath): string {
  const lines: string[] = [];

  lines.push(`Learning Path (${path.courses.length} courses, ${path.total_hours}h, $${path.total_cost})`);
  lines.push(`Coverage: ${path.coverage_percentage.toFixed(0)}% | Violations: ${path.prerequisite_violations}`);
  lines.push('');

  for (let i = 0; i < path.courses.length; i++) {
    const c = path.courses[i];
    lines.push(`${i + 1}. ${c.title} (${c.duration_hours}h, $${c.cost_usd})`);
    lines.push(`   Skills: ${c.skills_taught.join(', ')}`);
  }

  if (path.gaps_remaining.length > 0) {
    lines.push('');
    lines.push(`Remaining gaps: ${path.gaps_remaining.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Compare two learning paths
 */
export function comparePaths(a: LearningPath, b: LearningPath): {
  time_diff: number;
  coverage_diff: number;
  cost_diff: number;
  recommendation: string;
} {
  const timeDiff = a.total_hours - b.total_hours;
  const coverageDiff = a.coverage_percentage - b.coverage_percentage;
  const costDiff = a.total_cost - b.total_cost;

  let recommendation: string;
  if (timeDiff < 0 && coverageDiff >= 0) {
    recommendation = 'Path A is faster with equal or better coverage';
  } else if (timeDiff > 0 && coverageDiff <= 0) {
    recommendation = 'Path B is faster with equal or better coverage';
  } else if (coverageDiff > 10) {
    recommendation = 'Path A has significantly better coverage';
  } else if (coverageDiff < -10) {
    recommendation = 'Path B has significantly better coverage';
  } else {
    recommendation = 'Paths are comparable - choose based on preference';
  }

  return {
    time_diff: timeDiff,
    coverage_diff: coverageDiff,
    cost_diff: costDiff,
    recommendation,
  };
}
