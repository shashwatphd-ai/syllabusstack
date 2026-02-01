# ScholarChain Integration Plan for SyllabusStack
## Adapting Distributed Verification Architecture for Educational Credentials

**Version:** 1.0
**Date:** 2026-01-30
**Status:** Proposal
**Depends On:** MASTER_IMPLEMENTATION_PLAN_V3.md (Week 10+)

---

## Executive Summary

This document outlines how ScholarChain's Distributed Micro-Review Architecture can be adapted for SyllabusStack's specific needs. While ScholarChain was designed for academic peer review, its core innovations—chunk-based specialist verification, blockchain-anchored credentials, and commit-reveal integrity—translate powerfully to educational skill verification.

### Core Mapping: ScholarChain → SyllabusStack

| ScholarChain Concept | SyllabusStack Application |
|---------------------|---------------------------|
| Paper Decomposition | Skill Decomposition into Micro-Competencies |
| Micro-Review by Specialists | Micro-Assessment by Domain Validators |
| Blockchain Credential Verification | On-Chain Certificate & Skill Anchoring |
| Commit-Reveal for Reviews | Assessment Integrity & Anti-Cheating |
| VRF Random Assignment | Provably Fair Question Selection |
| Merit Token System | Enhanced XP with On-Chain Reputation |
| Merkle Tree Paper Integrity | Skill Portfolio Verification |

---

## The SyllabusStack Opportunity

### Current State
SyllabusStack already has:
- ✅ Three-tier certificate system (`completion_badge`, `verified`, `assessed`)
- ✅ Verified skills table with source tracking
- ✅ Identity verification via Persona/Onfido
- ✅ Instructor verification workflow
- ✅ Employer API for credential verification
- ✅ Proctored assessment sessions
- ✅ XP and achievement system

### What ScholarChain Adds
The integration brings:
- **Cryptographic Proof**: Immutable on-chain records of skill verification
- **Tamper-Proof Portfolios**: Merkle-tree verified skill collections
- **Provable Fairness**: VRF-based assessment question selection
- **Specialist Validation**: Domain experts verify specific competencies
- **Enhanced Trust**: Blockchain-anchored credentials for employers

---

## Architecture: Skill Verification Pipeline

### The SyllabusStack Micro-Verification Flow

```
SKILL CLAIM → DECOMPOSITION → COMPETENCY HASHING → VALIDATOR MATCHING
      ↓
RANDOM ASSESSMENT (VRF) → MICRO-EVALUATIONS → ENCRYPTED RESULTS
      ↓
REVEAL PHASE → AGGREGATION → SKILL VERIFICATION → BLOCKCHAIN ANCHOR
```

### Skill Decomposition Model

Learning objectives and skills are decomposed into verifiable micro-competencies:

| Competency Type | Content | Validator Type |
|----------------|---------|----------------|
| KNOWLEDGE | Factual recall, concepts, terminology | AI + Human Review |
| COMPREHENSION | Understanding, interpretation | AI Assessment |
| APPLICATION | Using knowledge in new situations | Project Review |
| ANALYSIS | Breaking down complex problems | Technical Reviewer |
| SYNTHESIS | Creating new solutions | Industry Expert |
| EVALUATION | Making judgments | Senior Practitioner |

**Example Decomposition:**

Skill: "Data Analysis with Python"
```
├── KNOWLEDGE: Python syntax, pandas library functions
├── COMPREHENSION: Understanding data structures, methods
├── APPLICATION: Writing data manipulation code
├── ANALYSIS: Identifying patterns in datasets
├── SYNTHESIS: Building complete analysis pipelines
└── EVALUATION: Choosing appropriate techniques
```

---

## Phase 1: Foundation (Weeks 11-14)

### Goal: Build core verification infrastructure with simulated blockchain

### 1.1 Micro-Competency Decomposition Engine

**New Table: `micro_competencies`**

```sql
CREATE TABLE micro_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES learning_objectives(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES verified_skills(id) ON DELETE CASCADE,
  competency_type TEXT NOT NULL CHECK (competency_type IN (
    'knowledge', 'comprehension', 'application',
    'analysis', 'synthesis', 'evaluation'
  )),
  description TEXT NOT NULL,
  bloom_level INTEGER CHECK (bloom_level BETWEEN 1 AND 6),
  content_hash TEXT NOT NULL, -- SHA-256 of competency definition
  required_evidence_types TEXT[] DEFAULT '{}',
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_micro_competencies_lo ON micro_competencies(learning_objective_id);
CREATE INDEX idx_micro_competencies_skill ON micro_competencies(skill_id);
CREATE INDEX idx_micro_competencies_hash ON micro_competencies(content_hash);
```

**New Edge Function: `decompose-skill`**

```typescript
// supabase/functions/decompose-skill/index.ts
// Uses AI to decompose a skill/learning objective into micro-competencies
// Tags each with Bloom's taxonomy level and evidence requirements
// Generates content hashes for integrity verification
```

### 1.2 Competency Hash Registry

**New Table: `competency_hashes`**

```sql
CREATE TABLE competency_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  micro_competency_id UUID NOT NULL REFERENCES micro_competencies(id),
  evidence_hash TEXT NOT NULL, -- Hash of assessment answer/project
  verification_status TEXT DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'failed', 'expired')
  ),
  verified_by UUID REFERENCES auth.users(id), -- Validator user
  verified_by_type TEXT CHECK (verified_by_type IN ('ai', 'instructor', 'expert', 'peer')),
  verification_score DECIMAL(5,2),
  merkle_proof JSONB, -- Proof for inclusion in skill portfolio
  blockchain_status TEXT DEFAULT 'not_anchored' CHECK (
    blockchain_status IN ('not_anchored', 'pending', 'anchored', 'failed')
  ),
  blockchain_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);
```

### 1.3 Assessment Integrity: Commit-Reveal

**Purpose:** Prevent answer sharing during timed assessments

**New Table: `assessment_commits`**

```sql
CREATE TABLE assessment_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_session_id UUID NOT NULL REFERENCES assessment_sessions(id),
  question_id UUID NOT NULL REFERENCES assessment_questions(id),
  answer_hash TEXT NOT NULL, -- SHA-256(answer + user_id + timestamp + nonce)
  nonce TEXT NOT NULL,
  committed_at TIMESTAMPTZ DEFAULT NOW(),
  revealed_at TIMESTAMPTZ,
  answer_matches_commit BOOLEAN,
  UNIQUE(assessment_session_id, question_id)
);
```

**Flow:**
1. Student receives question
2. Student submits answer → hash committed to database
3. After assessment window closes, all students reveal
4. System verifies revealed answers match commits
5. Prevents late modifications and time-zone exploitation

### 1.4 Validator Registry

**New Table: `skill_validators`**

```sql
CREATE TABLE skill_validators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  validator_type TEXT NOT NULL CHECK (validator_type IN (
    'instructor', 'industry_expert', 'peer', 'ai_assisted'
  )),
  expertise_areas TEXT[] NOT NULL,
  credentials JSONB DEFAULT '{}', -- Verified credentials
  reputation_score DECIMAL(5,2) DEFAULT 50.0,
  total_validations INTEGER DEFAULT 0,
  successful_validations INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE validator_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id UUID NOT NULL REFERENCES skill_validators(id) ON DELETE CASCADE,
  skill_category TEXT NOT NULL, -- e.g., "python", "data-analysis", "marketing"
  proficiency_level TEXT CHECK (proficiency_level IN ('intermediate', 'advanced', 'expert')),
  verified BOOLEAN DEFAULT false,
  verification_source TEXT, -- ORCID, LinkedIn, platform history
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 1 Deliverables

| Component | Description | Effort |
|-----------|-------------|--------|
| `micro_competencies` table + migration | Skill decomposition storage | 4h |
| `decompose-skill` edge function | AI-powered decomposition | 8h |
| `competency_hashes` table | Evidence tracking | 3h |
| `assessment_commits` table | Commit-reveal storage | 3h |
| Commit-reveal logic in assessment flow | Integrity verification | 8h |
| `skill_validators` + `validator_expertise` | Validator registry | 4h |
| Frontend: Decomposed skill display | Show micro-competencies | 6h |
| **Phase 1 Total** | | **36h** |

---

## Phase 2: Blockchain Integration (Weeks 15-18)

### Goal: Add cryptographic verification and on-chain anchoring

### 2.1 Smart Contract Architecture

**Contract: SkillRegistry.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SkillRegistry {
    struct SkillPortfolio {
        bytes32 merkleRoot;      // Root of all verified skills
        uint256 skillCount;
        uint256 lastUpdated;
        bool isValid;
    }

    struct Certificate {
        bytes32 contentHash;     // Hash of certificate data
        address issuer;          // Instructor/institution
        uint256 issuedAt;
        bool revoked;
    }

    mapping(bytes32 => SkillPortfolio) public portfolios; // userId hash → portfolio
    mapping(bytes32 => Certificate) public certificates;   // certificate hash → data

    event SkillVerified(bytes32 indexed userId, bytes32 skillHash, uint256 timestamp);
    event PortfolioUpdated(bytes32 indexed userId, bytes32 newMerkleRoot);
    event CertificateIssued(bytes32 indexed certHash, bytes32 indexed userId);
    event CertificateRevoked(bytes32 indexed certHash);

    function verifySkill(bytes32 userId, bytes32 skillHash) external;
    function updatePortfolio(bytes32 userId, bytes32 newMerkleRoot) external;
    function issueCertificate(bytes32 certHash, bytes32 userId) external;
    function verifyCertificate(bytes32 certHash) external view returns (bool, uint256);
}
```

**Contract: AssessmentIntegrity.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AssessmentIntegrity {
    using Chainlink VRF for question selection

    struct AssessmentSession {
        bytes32 sessionHash;
        bytes32 questionSetHash;  // VRF-selected questions
        bytes32[] answerCommits;
        bool revealed;
        uint256 createdAt;
    }

    mapping(bytes32 => AssessmentSession) public sessions;

    event QuestionsSelected(bytes32 indexed sessionId, bytes32 questionSetHash, uint256 vrfProof);
    event AnswerCommitted(bytes32 indexed sessionId, bytes32 commitHash);
    event SessionRevealed(bytes32 indexed sessionId);

    function requestRandomQuestions(bytes32 sessionId, uint256 poolSize, uint256 count) external;
    function commitAnswer(bytes32 sessionId, bytes32 commitHash) external;
    function revealSession(bytes32 sessionId, bytes32[] calldata answers) external;
}
```

### 2.2 Merkle Tree for Skill Portfolios

**Implementation:**
```typescript
// src/lib/merkle/skillPortfolio.ts

import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethers';

interface VerifiedSkill {
  skillName: string;
  proficiencyLevel: string;
  verifiedAt: Date;
  evidenceHash: string;
  validatorSignature: string;
}

export class SkillPortfolioMerkle {
  private tree: MerkleTree;
  private skills: VerifiedSkill[];

  constructor(skills: VerifiedSkill[]) {
    this.skills = skills;
    const leaves = skills.map(s => this.hashSkill(s));
    this.tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  private hashSkill(skill: VerifiedSkill): string {
    return keccak256(
      abiCoder.encode(
        ['string', 'string', 'uint256', 'bytes32'],
        [skill.skillName, skill.proficiencyLevel, skill.verifiedAt.getTime(), skill.evidenceHash]
      )
    );
  }

  getRoot(): string {
    return this.tree.getHexRoot();
  }

  getProof(skill: VerifiedSkill): string[] {
    const leaf = this.hashSkill(skill);
    return this.tree.getHexProof(leaf);
  }

  verify(skill: VerifiedSkill, proof: string[], root: string): boolean {
    const leaf = this.hashSkill(skill);
    return this.tree.verify(proof, leaf, root);
  }
}
```

### 2.3 VRF-Based Question Selection

**Purpose:** Provably random and fair assessment question selection

**New Table: `vrf_question_selections`**

```sql
CREATE TABLE vrf_question_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_session_id UUID NOT NULL REFERENCES assessment_sessions(id),
  request_id TEXT NOT NULL, -- Chainlink VRF request ID
  random_seed TEXT, -- VRF-generated randomness
  question_pool_hash TEXT NOT NULL, -- Hash of available questions
  selected_question_ids UUID[] NOT NULL,
  selection_proof TEXT, -- VRF proof for verification
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration with Chainlink VRF:**
```typescript
// supabase/functions/select-assessment-questions/index.ts

// 1. Hash the question pool (all eligible questions)
// 2. Request randomness from Chainlink VRF
// 3. Use VRF output to deterministically select questions
// 4. Store proof on-chain
// 5. Anyone can verify the selection was fair
```

### 2.4 Certificate Blockchain Anchoring

**Enhanced `certificates` table:**

```sql
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS blockchain_enabled BOOLEAN DEFAULT false;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS blockchain_network TEXT CHECK (
  blockchain_network IN ('base-sepolia', 'base-mainnet', 'polygon-mainnet')
);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS blockchain_anchored_at TIMESTAMPTZ;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS content_hash TEXT; -- For on-chain verification
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS merkle_proof JSONB; -- Proof in skill portfolio
```

**New Edge Function: `anchor-certificate`**

```typescript
// supabase/functions/anchor-certificate/index.ts
// 1. Generate content hash of certificate data
// 2. Submit to SkillRegistry contract
// 3. Wait for confirmation
// 4. Store tx hash and update status
```

### 2.5 Embedded Wallet Integration

**Using Privy for seamless UX:**

```typescript
// src/lib/blockchain/wallet.ts

import { usePrivy, useWallets } from '@privy-io/react-auth';

export function useBlockchainWallet() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  // Students get embedded wallets (no MetaMask needed)
  // Employers can connect existing wallets
  // All blockchain operations abstracted behind simple API
}
```

### Phase 2 Deliverables

| Component | Description | Effort |
|-----------|-------------|--------|
| SkillRegistry.sol contract | Skill & certificate anchoring | 16h |
| AssessmentIntegrity.sol contract | VRF + commit-reveal | 12h |
| Merkle tree library | Skill portfolio proofs | 8h |
| Chainlink VRF integration | Question selection | 12h |
| `anchor-certificate` edge function | Certificate anchoring | 8h |
| Privy wallet integration | Embedded wallets | 10h |
| Contract deployment (Base Sepolia) | Testnet deployment | 4h |
| Frontend: Blockchain status display | Show anchoring status | 6h |
| **Phase 2 Total** | | **76h** |

---

## Phase 3: Specialist Validation Network (Weeks 19-22)

### Goal: Enable expert validators to verify specialized competencies

### 3.1 Validator Matching Algorithm

```typescript
// supabase/functions/match-validators/index.ts

interface ValidatorMatch {
  validatorId: string;
  expertiseScore: number;  // 0-1 match with skill
  reputationScore: number; // Historical accuracy
  availabilityScore: number;
  compositeScore: number;
}

async function matchValidatorsToCompetency(
  competencyId: string,
  requiredCount: number = 2
): Promise<ValidatorMatch[]> {
  // 1. Get competency details and required expertise
  // 2. Query validators with matching expertise
  // 3. Filter by availability and conflicts
  // 4. Score and rank by expertise + reputation
  // 5. Use VRF to randomly select from top tier
  // 6. Return matched validators
}
```

### 3.2 Validation Task Queue

**New Table: `validation_tasks`**

```sql
CREATE TABLE validation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_hash_id UUID NOT NULL REFERENCES competency_hashes(id),
  validator_id UUID NOT NULL REFERENCES skill_validators(id),
  task_type TEXT NOT NULL CHECK (task_type IN (
    'evidence_review', 'project_evaluation', 'interview', 'practical_demo'
  )),
  status TEXT DEFAULT 'assigned' CHECK (status IN (
    'assigned', 'in_progress', 'submitted', 'revealed', 'complete'
  )),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  -- Commit-reveal for validation scores
  score_commit_hash TEXT,
  score_committed_at TIMESTAMPTZ,
  final_score DECIMAL(5,2),
  feedback TEXT,
  revealed_at TIMESTAMPTZ,
  validation_weight DECIMAL(3,2) DEFAULT 1.0, -- Based on validator reputation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_tasks_validator ON validation_tasks(validator_id);
CREATE INDEX idx_validation_tasks_status ON validation_tasks(status);
```

### 3.3 Consensus Aggregation

**Scoring Algorithm:**
```typescript
interface ValidationResult {
  validatorId: string;
  score: number;
  weight: number; // reputation-based
}

function aggregateValidations(results: ValidationResult[]): {
  finalScore: number;
  consensus: boolean;
  disagreement: number;
} {
  // Weighted average based on validator reputation
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const weightedScore = results.reduce(
    (sum, r) => sum + (r.score * r.weight), 0
  ) / totalWeight;

  // Check for consensus (all scores within 1.5 points)
  const scores = results.map(r => r.score);
  const maxSpread = Math.max(...scores) - Math.min(...scores);
  const consensus = maxSpread <= 1.5;

  return {
    finalScore: weightedScore,
    consensus,
    disagreement: maxSpread
  };
}
```

### 3.4 Instructor as Validator

**Integration with existing instructor verification:**

```sql
-- Auto-create validator profile when instructor is verified
CREATE OR REPLACE FUNCTION create_instructor_validator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO skill_validators (
      user_id,
      validator_type,
      expertise_areas,
      credentials,
      verified_at
    )
    SELECT
      NEW.user_id,
      'instructor',
      ARRAY(
        SELECT DISTINCT skill_category
        FROM instructor_courses ic
        JOIN course_skills cs ON ic.id = cs.instructor_course_id
        WHERE ic.instructor_id = NEW.user_id
      ),
      jsonb_build_object(
        'institution', NEW.institution_name,
        'edu_domain_verified', NEW.edu_domain_verified,
        'linkedin_verified', NEW.linkedin_verified,
        'trust_score', NEW.trust_score
      ),
      NOW()
    ON CONFLICT (user_id) DO UPDATE SET
      credentials = EXCLUDED.credentials,
      verified_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3.5 Industry Expert Onboarding

**New Table: `expert_applications`**

```sql
CREATE TABLE expert_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  expertise_areas TEXT[] NOT NULL,
  years_experience INTEGER,
  current_role TEXT,
  company TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  credentials JSONB DEFAULT '{}', -- Certifications, degrees
  references JSONB DEFAULT '[]', -- Professional references
  application_status TEXT DEFAULT 'pending' CHECK (
    application_status IN ('pending', 'under_review', 'approved', 'rejected')
  ),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 3 Deliverables

| Component | Description | Effort |
|-----------|-------------|--------|
| Validator matching algorithm | Expertise-based matching | 10h |
| `validation_tasks` table + queue | Task distribution | 6h |
| Commit-reveal for validation scores | Prevent groupthink | 8h |
| Consensus aggregation logic | Score aggregation | 6h |
| Instructor → Validator auto-creation | Leverage existing instructors | 4h |
| Expert application flow | Onboard industry experts | 12h |
| Validator dashboard | Task management UI | 16h |
| **Phase 3 Total** | | **62h** |

---

## Phase 4: Employer Integration (Weeks 23-26)

### Goal: Enhanced employer verification with blockchain proofs

### 4.1 Enhanced Verification API

**New Endpoints:**

```typescript
// GET /api/verify/certificate/:shareToken
// Returns: Certificate data + blockchain proof + Merkle proof

// GET /api/verify/portfolio/:userId
// Returns: Complete skill portfolio with Merkle root verification

// POST /api/verify/batch
// Body: { certificate_numbers: string[] }
// Returns: Batch verification with blockchain status

// GET /api/verify/skill/:userId/:skillName
// Returns: Skill verification with proof chain
```

### 4.2 Blockchain Verification Portal

**Employer can verify:**
1. Certificate authenticity → Check on-chain hash
2. Skill portfolio → Verify Merkle root
3. Assessment integrity → Confirm VRF selection was fair
4. Validator credentials → Check validator reputation

### 4.3 LinkedIn Badge Integration

**Shareable credentials with blockchain proof:**

```typescript
interface LinkedInBadge {
  name: string;
  description: string;
  issuer: {
    name: string;
    url: string;
  };
  image: string;
  criteria: string;
  evidence: {
    id: string; // Blockchain tx hash
    type: 'BlockchainVerification';
    verificationUrl: string;
  };
}
```

### Phase 4 Deliverables

| Component | Description | Effort |
|-----------|-------------|--------|
| Enhanced verification API endpoints | Blockchain-aware | 12h |
| Verification portal UI for employers | Visual verification | 16h |
| LinkedIn badge generation | Shareable credentials | 8h |
| Webhook enhancements | Include blockchain data | 4h |
| **Phase 4 Total** | | **40h** |

---

## Phase 5: Token Economics (Weeks 27-30)

### Goal: Merit-based incentive system with on-chain reputation

### 5.1 Merit Token Design

**Token Properties:**
- **Non-transferable initially** (Soulbound)
- **Earned through platform actions:**
  - Complete assessment: +10 MERIT
  - Pass with high score (>90%): +20 MERIT bonus
  - Validate a skill accurately: +5 MERIT
  - Receive validation agreement: +2 MERIT
  - Earn certificate: +50 MERIT
  - Get employer verification: +10 MERIT

**Token Utility:**
- Voting weight in platform governance
- Priority queue for high-demand courses
- Unlock advanced assessment features
- Badge display tiers

### 5.2 Integration with Existing XP

```sql
-- Link XP events to MERIT token minting
CREATE TABLE merit_earning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  merit_amount INTEGER NOT NULL,
  source_id UUID, -- Assessment, certificate, etc.
  blockchain_minted BOOLEAN DEFAULT false,
  mint_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to calculate MERIT from XP events
CREATE OR REPLACE FUNCTION calculate_merit_reward(
  p_event_type TEXT,
  p_score DECIMAL DEFAULT NULL
) RETURNS INTEGER AS $$
BEGIN
  CASE p_event_type
    WHEN 'assessment_complete' THEN RETURN 10;
    WHEN 'assessment_high_score' THEN RETURN 20;
    WHEN 'certificate_earned' THEN RETURN 50;
    WHEN 'skill_validated' THEN RETURN 5;
    WHEN 'validation_agreed' THEN RETURN 2;
    WHEN 'employer_verified' THEN RETURN 10;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;
```

### Phase 5 Deliverables

| Component | Description | Effort |
|-----------|-------------|--------|
| MeritToken.sol contract | ERC-20 with restrictions | 12h |
| Merit earning events table | Track earning | 4h |
| XP → MERIT integration | Automatic conversion | 8h |
| Token dashboard UI | Display balance + history | 10h |
| Governance voting (basic) | Simple proposals | 16h |
| **Phase 5 Total** | | **50h** |

---

## Technical Stack Additions

### Smart Contract Deployment

| Network | Purpose | When |
|---------|---------|------|
| Base Sepolia | Development/Testing | Phase 2 |
| Base Mainnet | Production | Phase 5 |

### New Dependencies

```json
{
  "dependencies": {
    "@privy-io/react-auth": "^1.x",
    "ethers": "^6.x",
    "merkletreejs": "^0.3.x",
    "@chainlink/contracts": "^0.8.x"
  }
}
```

### Infrastructure

| Service | Purpose | Cost Estimate |
|---------|---------|---------------|
| Privy | Embedded wallets | $200-500/mo |
| Chainlink VRF | Random selection | ~$0.25/request |
| Base L2 | Low gas fees | ~$0.001/tx |
| IPFS (Pinata) | Credential storage | $20/mo |

---

## Database Schema Summary

### New Tables (11)

| Table | Purpose | Phase |
|-------|---------|-------|
| `micro_competencies` | Skill decomposition | 1 |
| `competency_hashes` | Evidence tracking | 1 |
| `assessment_commits` | Commit-reveal | 1 |
| `skill_validators` | Validator registry | 1 |
| `validator_expertise` | Expertise areas | 1 |
| `vrf_question_selections` | Fair question selection | 2 |
| `validation_tasks` | Validation queue | 3 |
| `expert_applications` | Expert onboarding | 3 |
| `merit_earning_events` | Token earning | 5 |
| `blockchain_transactions` | TX tracking | 2 |
| `merkle_snapshots` | Portfolio snapshots | 2 |

### Modified Tables (2)

| Table | Changes | Phase |
|-------|---------|-------|
| `certificates` | +blockchain fields | 2 |
| `verified_skills` | +merkle_proof, +blockchain_status | 2 |

---

## Edge Functions (New)

| Function | Purpose | Phase |
|----------|---------|-------|
| `decompose-skill` | AI skill decomposition | 1 |
| `commit-assessment-answer` | Commit phase | 1 |
| `reveal-assessment` | Reveal phase | 1 |
| `match-validators` | Expertise matching | 3 |
| `select-assessment-questions` | VRF selection | 2 |
| `anchor-certificate` | Blockchain anchoring | 2 |
| `anchor-skill-portfolio` | Portfolio anchoring | 2 |
| `create-merkle-proof` | Generate proofs | 2 |
| `verify-blockchain-credential` | Verification | 4 |
| `mint-merit-tokens` | Token minting | 5 |

---

## Success Metrics

### Phase 1 (Foundation)
- [ ] Skill decomposition working for 90%+ learning objectives
- [ ] Commit-reveal reducing answer modification attempts by >50%
- [ ] 100+ active validators registered

### Phase 2 (Blockchain)
- [ ] 100% certificates blockchain-anchored
- [ ] VRF question selection live
- [ ] <2 second verification response time

### Phase 3 (Validation Network)
- [ ] 50+ industry expert validators
- [ ] >80% validation consensus rate
- [ ] <24 hour average validation turnaround

### Phase 4 (Employer)
- [ ] 10+ employers using blockchain verification
- [ ] >95% verification success rate
- [ ] LinkedIn badge sharing enabled

### Phase 5 (Token)
- [ ] MERIT token live on mainnet
- [ ] 1000+ users with earned tokens
- [ ] Basic governance operational

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Blockchain complexity | Privy abstracts wallet UX |
| Gas costs | Base L2 keeps costs minimal |
| Validator shortage | Start with instructors, gradual expert onboarding |
| Regulatory concerns | Non-transferable tokens, utility focus |
| User adoption | Optional blockchain features, seamless fallback |

---

## Implementation Timeline

| Phase | Weeks | Focus | Hours |
|-------|-------|-------|-------|
| 1 | 11-14 | Foundation (off-chain simulation) | 36h |
| 2 | 15-18 | Blockchain integration | 76h |
| 3 | 19-22 | Validator network | 62h |
| 4 | 23-26 | Employer integration | 40h |
| 5 | 27-30 | Token economics | 50h |
| **Total** | **20 weeks** | | **264h** |

---

## Appendix A: Comparison with Original ScholarChain

| ScholarChain Feature | SyllabusStack Adaptation | Key Difference |
|---------------------|--------------------------|----------------|
| Paper chunks | Micro-competencies | Skill-focused, not document-focused |
| Peer reviewers | Validators (instructors + experts) | Educational context |
| Publication decision | Skill verification | Binary verification, not editorial |
| Merit points | MERIT tokens | Same concept, on-chain |
| DOI integration | LinkedIn + employer API | Professional credentialing |

## Appendix B: Why Blockchain for SyllabusStack

1. **Employer Trust**: Tamper-proof credentials solve the diploma mill problem
2. **Portability**: Skills belong to students, not platforms
3. **Transparency**: Public verification without centralized trust
4. **Fairness**: VRF proves assessment selection wasn't rigged
5. **Accountability**: Validators have on-chain reputation

---

*ScholarChain Integration Plan for SyllabusStack*
*Generated: 2026-01-30*
*Starts after: MASTER_IMPLEMENTATION_PLAN_V3.md completion (Week 10)*
