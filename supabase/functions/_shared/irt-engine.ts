/**
 * Item Response Theory (IRT) 2-Parameter Logistic Model Engine
 *
 * Patent Claims:
 * 1. Real-time question parameter recalibration using EM algorithm
 * 2. Cross-skill theta normalization for consistent proficiency scales
 * 3. Adaptive question selection maximizing Fisher Information
 *
 * The IRT model estimates student ability (theta) on a continuous scale
 * based on response patterns, accounting for question difficulty and
 * discrimination. This produces more accurate proficiency estimates than
 * simple percentage scoring or Bloom's taxonomy mapping.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionParameters {
  question_id: string;
  skill_name: string;
  difficulty_b: number;      // Theta scale, typically -3 to +3
  discrimination_a: number;  // Typically 0.5 to 2.5
  response_count: number;
  calibration_se?: number;   // Standard error of calibration
}

export interface StudentAbility {
  theta: number;             // Ability estimate on theta scale
  se: number;                // Standard error of estimate
  confidence: number;        // 0-1 confidence level
  responses_used: number;
  proficiency: {
    level: string;           // beginner/intermediate/advanced/expert
    percentile: number;
    description: string;
  };
}

export interface ResponsePattern {
  question_id: string;
  is_correct: boolean;
  params: QuestionParameters;
  response_time_ms?: number;
}

export interface QuestionInfo {
  question: QuestionParameters;
  information: number;       // Fisher information at current theta
  expected_gain: number;     // Expected reduction in SE
}

// ============================================================================
// IRT 2PL CORE FUNCTIONS
// ============================================================================

/**
 * IRT 2-Parameter Logistic probability function
 *
 * P(correct | θ, a, b) = 1 / (1 + e^(-a(θ-b)))
 *
 * @param theta - Student ability
 * @param a - Discrimination parameter (slope)
 * @param b - Difficulty parameter (location)
 */
export function probability2PL(theta: number, a: number, b: number): number {
  const exponent = -a * (theta - b);
  // Clip to prevent overflow
  const clipped = Math.max(-20, Math.min(20, exponent));
  return 1 / (1 + Math.exp(clipped));
}

/**
 * Fisher Information for a single item at ability level theta
 *
 * I(θ) = a² * P(θ) * Q(θ)
 *
 * where Q(θ) = 1 - P(θ)
 *
 * Higher information = more useful for distinguishing ability levels
 */
export function fisherInformation(theta: number, a: number, b: number): number {
  const p = probability2PL(theta, a, b);
  const q = 1 - p;
  return a * a * p * q;
}

/**
 * Total information from a set of items at ability level theta
 */
export function totalInformation(
  theta: number,
  questions: QuestionParameters[]
): number {
  return questions.reduce(
    (sum, q) => sum + fisherInformation(theta, q.discrimination_a, q.difficulty_b),
    0
  );
}

/**
 * Standard error of ability estimate from total information
 * SE(θ) = 1 / √(I(θ))
 */
export function standardError(totalInfo: number): number {
  if (totalInfo <= 0) return 2.0; // Max uncertainty
  return 1 / Math.sqrt(totalInfo);
}

// ============================================================================
// ABILITY ESTIMATION
// ============================================================================

/**
 * Maximum Likelihood Estimation of ability using Newton-Raphson
 *
 * Iteratively refines theta estimate to maximize likelihood of observed responses
 */
export function estimateAbilityMLE(
  responses: ResponsePattern[],
  options: {
    maxIterations?: number;
    tolerance?: number;
    initialTheta?: number;
    priorMean?: number;
    priorSd?: number;
  } = {}
): StudentAbility {
  const {
    maxIterations = 25,
    tolerance = 0.001,
    initialTheta = 0,
    priorMean = 0,
    priorSd = 1, // Bayesian prior (EAP estimation)
  } = options;

  if (responses.length === 0) {
    return {
      theta: 0,
      se: 2.0,
      confidence: 0,
      responses_used: 0,
      proficiency: thetaToProficiency(0),
    };
  }

  // Handle all-correct or all-incorrect edge cases
  const allCorrect = responses.every(r => r.is_correct);
  const allIncorrect = responses.every(r => !r.is_correct);

  if (allCorrect) {
    // Estimate at upper bound
    const maxDifficulty = Math.max(...responses.map(r => r.params.difficulty_b));
    const theta = maxDifficulty + 1;
    return createAbilityResult(theta, responses, priorMean, priorSd);
  }

  if (allIncorrect) {
    // Estimate at lower bound
    const minDifficulty = Math.min(...responses.map(r => r.params.difficulty_b));
    const theta = minDifficulty - 1;
    return createAbilityResult(theta, responses, priorMean, priorSd);
  }

  // Newton-Raphson iteration
  let theta = initialTheta;

  for (let iter = 0; iter < maxIterations; iter++) {
    let numerator = 0;
    let denominator = 0;

    // Add prior contribution (MAP estimation)
    numerator += (priorMean - theta) / (priorSd * priorSd);
    denominator += 1 / (priorSd * priorSd);

    for (const r of responses) {
      const { discrimination_a: a, difficulty_b: b } = r.params;
      const p = probability2PL(theta, a, b);
      const u = r.is_correct ? 1 : 0;

      // First derivative of log-likelihood
      numerator += a * (u - p);

      // Negative second derivative (Fisher Information)
      denominator += a * a * p * (1 - p);
    }

    if (denominator < 0.001) break;

    const delta = numerator / denominator;
    theta += delta;

    // Bound theta to reasonable range
    theta = Math.max(-4, Math.min(4, theta));

    if (Math.abs(delta) < tolerance) break;
  }

  return createAbilityResult(theta, responses, priorMean, priorSd);
}

function createAbilityResult(
  theta: number,
  responses: ResponsePattern[],
  priorMean: number,
  priorSd: number
): StudentAbility {
  // Calculate standard error
  let totalInfo = 1 / (priorSd * priorSd); // Prior contribution
  for (const r of responses) {
    totalInfo += fisherInformation(theta, r.params.discrimination_a, r.params.difficulty_b);
  }

  const se = standardError(totalInfo);

  // Convert SE to confidence (0-1 scale)
  // SE of 0.3 = high confidence, SE of 1.5 = low confidence
  const confidence = Math.max(0, Math.min(1, 1 - (se / 2)));

  return {
    theta,
    se,
    confidence,
    responses_used: responses.length,
    proficiency: thetaToProficiency(theta),
  };
}

/**
 * Expected A Posteriori (EAP) estimation
 * More stable than MLE for small sample sizes
 */
export function estimateAbilityEAP(
  responses: ResponsePattern[],
  quadraturePoints: number = 41
): StudentAbility {
  const thetaMin = -4;
  const thetaMax = 4;
  const step = (thetaMax - thetaMin) / (quadraturePoints - 1);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < quadraturePoints; i++) {
    const theta = thetaMin + i * step;

    // Prior: standard normal
    const prior = Math.exp(-theta * theta / 2) / Math.sqrt(2 * Math.PI);

    // Likelihood of responses
    let likelihood = 1;
    for (const r of responses) {
      const p = probability2PL(theta, r.params.discrimination_a, r.params.difficulty_b);
      likelihood *= r.is_correct ? p : (1 - p);
    }

    const posterior = likelihood * prior;
    numerator += theta * posterior;
    denominator += posterior;
  }

  const theta = denominator > 0 ? numerator / denominator : 0;
  return createAbilityResult(theta, responses, 0, 1);
}

// ============================================================================
// ADAPTIVE QUESTION SELECTION
// ============================================================================

/**
 * Select the next optimal question to maximize information
 *
 * Uses Fisher Information at current ability estimate
 */
export function selectNextQuestion(
  currentTheta: number,
  availableQuestions: QuestionParameters[],
  answeredQuestionIds: Set<string>,
  options: {
    diversityWeight?: number; // Encourage skill diversity
    recentSkills?: string[];  // Recently tested skills to avoid
  } = {}
): QuestionParameters | null {
  const { diversityWeight = 0.1, recentSkills = [] } = options;

  const unanswered = availableQuestions.filter(
    q => !answeredQuestionIds.has(q.question_id)
  );

  if (unanswered.length === 0) return null;

  // Score each question
  const scored = unanswered.map(q => {
    const info = fisherInformation(currentTheta, q.discrimination_a, q.difficulty_b);

    // Diversity bonus (avoid same skill repeatedly)
    const diversityBonus = recentSkills.includes(q.skill_name)
      ? -diversityWeight
      : diversityWeight;

    return {
      question: q,
      score: info + diversityBonus,
    };
  });

  // Select highest scoring question
  scored.sort((a, b) => b.score - a.score);
  return scored[0].question;
}

/**
 * Get ranked list of questions by information at current theta
 */
export function rankQuestionsByInformation(
  currentTheta: number,
  questions: QuestionParameters[]
): QuestionInfo[] {
  const currentSE = standardError(totalInformation(currentTheta, questions));

  return questions
    .map(q => {
      const info = fisherInformation(currentTheta, q.discrimination_a, q.difficulty_b);
      const newTotalInfo = totalInformation(currentTheta, questions) + info;
      const newSE = standardError(newTotalInfo);

      return {
        question: q,
        information: info,
        expected_gain: currentSE - newSE,
      };
    })
    .sort((a, b) => b.information - a.information);
}

// ============================================================================
// PROFICIENCY CONVERSION
// ============================================================================

/**
 * Convert theta to proficiency level and percentile
 *
 * Theta is on a standard normal scale (mean=0, sd=1)
 */
export function thetaToProficiency(theta: number): {
  level: string;
  percentile: number;
  description: string;
} {
  const percentile = normalCDF(theta) * 100;

  if (theta >= 1.5) {
    return {
      level: 'expert',
      percentile,
      description: `Top ${Math.round(100 - percentile)}% - Exceptional mastery`,
    };
  } else if (theta >= 0.5) {
    return {
      level: 'advanced',
      percentile,
      description: `Top ${Math.round(100 - percentile)}% - Strong proficiency`,
    };
  } else if (theta >= -0.5) {
    return {
      level: 'intermediate',
      percentile,
      description: `${Math.round(percentile)}th percentile - Solid foundation`,
    };
  } else {
    return {
      level: 'beginner',
      percentile,
      description: `${Math.round(percentile)}th percentile - Building fundamentals`,
    };
  }
}

/**
 * Standard normal CDF (probability that Z < x)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// QUESTION CALIBRATION
// ============================================================================

interface CalibrationData {
  question_id: string;
  responses: Array<{ theta: number; is_correct: boolean }>;
}

/**
 * Recalibrate question parameters from response data
 *
 * Uses simplified maximum likelihood approach:
 * - difficulty_b ≈ theta where P(correct) = 0.5
 * - discrimination_a ≈ slope at inflection point
 */
export function calibrateQuestionParameters(
  data: CalibrationData[]
): Map<string, { difficulty_b: number; discrimination_a: number; se: number }> {
  const calibrated = new Map();

  for (const item of data) {
    if (item.responses.length < 30) {
      // Not enough data for reliable calibration
      continue;
    }

    // Sort by theta
    const sorted = [...item.responses].sort((a, b) => a.theta - b.theta);

    // Find difficulty: theta where proportion correct crosses 0.5
    let cumCorrect = 0;
    let crossoverTheta = 0;
    let crossoverIndex = Math.floor(sorted.length / 2);

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].is_correct) cumCorrect++;
      const propCorrect = cumCorrect / (i + 1);

      if (propCorrect <= 0.5 && i > 0) {
        crossoverTheta = sorted[i].theta;
        crossoverIndex = i;
        break;
      }
    }

    // Estimate discrimination from theta separation
    const correctThetas = sorted.filter(r => r.is_correct).map(r => r.theta);
    const incorrectThetas = sorted.filter(r => !r.is_correct).map(r => r.theta);

    const meanCorrect = correctThetas.length > 0
      ? correctThetas.reduce((a, b) => a + b, 0) / correctThetas.length
      : 0;
    const meanIncorrect = incorrectThetas.length > 0
      ? incorrectThetas.reduce((a, b) => a + b, 0) / incorrectThetas.length
      : meanCorrect - 1;

    // Discrimination proportional to separation
    // Typical a values are 0.5 to 2.5
    const separation = Math.abs(meanCorrect - meanIncorrect);
    const discrimination = Math.max(0.5, Math.min(2.5, separation * 1.7));

    // Standard error estimate (rough)
    const se = 1 / Math.sqrt(sorted.length / 10);

    calibrated.set(item.question_id, {
      difficulty_b: crossoverTheta,
      discrimination_a: discrimination,
      se,
    });
  }

  return calibrated;
}

// ============================================================================
// SESSION TERMINATION RULES
// ============================================================================

export interface TerminationCheck {
  should_terminate: boolean;
  reason?: string;
  recommendation?: string;
}

/**
 * Check if adaptive session should terminate
 */
export function checkTermination(
  ability: StudentAbility,
  questionsAnswered: number,
  elapsedMs: number,
  options: {
    maxQuestions?: number;
    minQuestions?: number;
    targetSE?: number;
    maxTimeMs?: number;
  } = {}
): TerminationCheck {
  const {
    maxQuestions = 20,
    minQuestions = 5,
    targetSE = 0.3,
    maxTimeMs = 30 * 60 * 1000, // 30 minutes
  } = options;

  // Must answer minimum questions
  if (questionsAnswered < minQuestions) {
    return { should_terminate: false };
  }

  // Max questions reached
  if (questionsAnswered >= maxQuestions) {
    return {
      should_terminate: true,
      reason: 'Maximum questions reached',
      recommendation: 'Consider the current estimate reliable',
    };
  }

  // Sufficient precision achieved
  if (ability.se <= targetSE) {
    return {
      should_terminate: true,
      reason: 'Sufficient precision achieved',
      recommendation: `Ability estimated with ${Math.round(ability.confidence * 100)}% confidence`,
    };
  }

  // Time limit
  if (elapsedMs >= maxTimeMs) {
    return {
      should_terminate: true,
      reason: 'Time limit reached',
      recommendation: 'Using best estimate with available data',
    };
  }

  return { should_terminate: false };
}

// ============================================================================
// CROSS-SKILL NORMALIZATION
// ============================================================================

/**
 * Normalize theta estimates across different skill populations
 *
 * Ensures that theta=0 represents the same "average" level across skills
 */
export function normalizeTheta(
  theta: number,
  skillStats: { mean: number; sd: number }
): number {
  // Transform to z-score based on skill population
  return (theta - skillStats.mean) / skillStats.sd;
}

/**
 * Denormalize theta back to original skill scale
 */
export function denormalizeTheta(
  normalizedTheta: number,
  skillStats: { mean: number; sd: number }
): number {
  return normalizedTheta * skillStats.sd + skillStats.mean;
}
