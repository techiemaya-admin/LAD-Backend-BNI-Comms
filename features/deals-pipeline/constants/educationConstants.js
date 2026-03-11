/**
 * Education Constants
 * LAD-Compliant: Constants for education vertical features
 */

/**
 * Education levels
 */
const EDUCATION_LEVELS = {
  HIGH_SCHOOL: 'high_school',
  BACHELORS: 'bachelors',
  MASTERS: 'masters',
  PHD: 'phd',
};

const EDUCATION_LEVELS_DISPLAY = [
  { key: 'high_school', label: 'High School' },
  { key: 'bachelors', label: 'Bachelor\'s Degree' },
  { key: 'masters', label: 'Master\'s Degree' },
  { key: 'phd', label: 'PhD' },
];

/**
 * Target degree types
 */
const DEGREE_TYPES = {
  UNDERGRADUATE: 'undergraduate',
  GRADUATE: 'graduate',
  POSTGRADUATE: 'postgraduate',
  DIPLOMA: 'diploma',
  CERTIFICATE: 'certificate',
};

const DEGREE_TYPES_DISPLAY = [
  { key: 'undergraduate', label: 'Undergraduate' },
  { key: 'graduate', label: 'Graduate' },
  { key: 'postgraduate', label: 'Postgraduate' },
  { key: 'diploma', label: 'Diploma' },
  { key: 'certificate', label: 'Certificate' },
];

/**
 * Test score ranges for validation
 */
const TEST_SCORE_RANGES = {
  SAT: { min: 400, max: 1600 },
  ACT: { min: 1, max: 36 },
  TOEFL: { min: 0, max: 120 },
  IELTS: { min: 0, max: 9 },
  GRE: { min: 260, max: 340 },
  GMAT: { min: 200, max: 800 },
};

/**
 * Popular target countries for education
 */
const TARGET_COUNTRIES = [
  { key: 'usa', label: 'United States' },
  { key: 'uk', label: 'United Kingdom' },
  { key: 'canada', label: 'Canada' },
  { key: 'australia', label: 'Australia' },
  { key: 'germany', label: 'Germany' },
  { key: 'france', label: 'France' },
  { key: 'netherlands', label: 'Netherlands' },
  { key: 'singapore', label: 'Singapore' },
  { key: 'ireland', label: 'Ireland' },
  { key: 'new_zealand', label: 'New Zealand' },
];

/**
 * Budget ranges for education
 */
const BUDGET_RANGES = [
  { key: 'under_10k', label: 'Under $10,000' },
  { key: '10k_25k', label: '$10,000 - $25,000' },
  { key: '25k_50k', label: '$25,000 - $50,000' },
  { key: '50k_75k', label: '$50,000 - $75,000' },
  { key: '75k_100k', label: '$75,000 - $100,000' },
  { key: 'above_100k', label: 'Above $100,000' },
  { key: 'flexible', label: 'Flexible' },
];

/**
 * Intake periods (semesters)
 */
const INTAKE_PERIODS = [
  { key: 'fall_2024', label: 'Fall 2024' },
  { key: 'spring_2025', label: 'Spring 2025' },
  { key: 'fall_2025', label: 'Fall 2025' },
  { key: 'spring_2026', label: 'Spring 2026' },
  { key: 'fall_2026', label: 'Fall 2026' },
  { key: 'undecided', label: 'Undecided' },
];

/**
 * Popular majors/fields of study
 */
const POPULAR_MAJORS = [
  { key: 'computer_science', label: 'Computer Science' },
  { key: 'business', label: 'Business Administration' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'data_science', label: 'Data Science' },
  { key: 'medicine', label: 'Medicine' },
  { key: 'law', label: 'Law' },
  { key: 'arts', label: 'Arts & Humanities' },
  { key: 'social_sciences', label: 'Social Sciences' },
  { key: 'natural_sciences', label: 'Natural Sciences' },
  { key: 'education', label: 'Education' },
];

/**
 * GPA scales by country
 */
const GPA_SCALES = {
  US: { min: 0.0, max: 4.0 },
  UK: { min: 0.0, max: 100.0 }, // Percentage
  CANADA: { min: 0.0, max: 4.0 },
  AUSTRALIA: { min: 0.0, max: 7.0 },
  INDIA: { min: 0.0, max: 10.0 },
  GERMANY: { min: 1.0, max: 6.0 }, // Lower is better
};

/**
 * Counsellor specializations
 */
const COUNSELLOR_SPECIALIZATIONS = [
  { key: 'undergraduate', label: 'Undergraduate Admissions' },
  { key: 'graduate', label: 'Graduate Admissions' },
  { key: 'mba', label: 'MBA Programs' },
  { key: 'stem', label: 'STEM Programs' },
  { key: 'arts', label: 'Arts & Humanities' },
  { key: 'medicine', label: 'Medical Programs' },
  { key: 'law', label: 'Law Programs' },
  { key: 'test_prep', label: 'Test Preparation' },
  { key: 'visa', label: 'Visa Counselling' },
  { key: 'scholarships', label: 'Scholarships & Financial Aid' },
];

/**
 * Application stages specific to education
 */
const EDUCATION_STAGES = [
  { key: 'inquiry', label: 'Inquiry', color: '#94A3B8', display_order: 1 },
  { key: 'profile_review', label: 'Profile Review', color: '#60A5FA', display_order: 2 },
  { key: 'university_shortlist', label: 'University Shortlist', color: '#818CF8', display_order: 3 },
  { key: 'document_prep', label: 'Document Preparation', color: '#A78BFA', display_order: 4 },
  { key: 'application_submitted', label: 'Application Submitted', color: '#F59E0B', display_order: 5 },
  { key: 'awaiting_decision', label: 'Awaiting Decision', color: '#FB923C', display_order: 6 },
  { key: 'offer_received', label: 'Offer Received', color: '#34D399', display_order: 7 },
  { key: 'visa_process', label: 'Visa Process', color: '#10B981', display_order: 8 },
  { key: 'enrolled', label: 'Enrolled', color: '#059669', display_order: 9 },
  { key: 'rejected', label: 'Rejected', color: '#EF4444', display_order: 10 },
  { key: 'withdrawn', label: 'Withdrawn', color: '#6B7280', display_order: 11 },
];

/**
 * Validation helper function
 */
function validateTestScore(testType, score) {
  const range = TEST_SCORE_RANGES[testType.toUpperCase()];
  if (!range) {
    throw new Error(`Unknown test type: ${testType}`);
  }
  
  if (score < range.min || score > range.max) {
    throw new Error(
      `${testType} score must be between ${range.min} and ${range.max}`
    );
  }
  
  return true;
}

module.exports = {
  EDUCATION_LEVELS,
  EDUCATION_LEVELS_DISPLAY,
  DEGREE_TYPES,
  DEGREE_TYPES_DISPLAY,
  TEST_SCORE_RANGES,
  TARGET_COUNTRIES,
  BUDGET_RANGES,
  INTAKE_PERIODS,
  POPULAR_MAJORS,
  GPA_SCALES,
  COUNSELLOR_SPECIALIZATIONS,
  EDUCATION_STAGES,
  validateTestScore,
};
