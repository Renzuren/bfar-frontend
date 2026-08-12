// src/lib/preprocessing.js
// Data preprocessing utilities for form responses and inputs

/**
 * Preprocesses form answers before submission
 * @param {Object} answers - Raw answers object
 * @param {Array} questions - Form questions array
 * @returns {Object} Preprocessed answers
 */
export const preprocessFormAnswers = (answers, questions) => {
  const processed = {};

  questions.forEach(question => {
    const answer = answers[question.id];

    if (answer === undefined || answer === null) {
      processed[question.id] = null;
      return;
    }

    switch (question.type) {
      case 'multiple_choice':
      case 'dropdown':
        processed[question.id] = preprocessSingleChoice(answer);
        break;

      case 'checkboxes':
        processed[question.id] = preprocessMultipleChoice(answer);
        break;

      case 'date':
        processed[question.id] = preprocessDate(answer);
        break;

      case 'rating':
        processed[question.id] = preprocessRating(answer);
        break;

      default:
        processed[question.id] = answer;
    }
  });

  return processed;
};

/**
 * Preprocesses text inputs (trimming, sanitization)
 * @param {string} text - Raw text input
 * @returns {string} Processed text
 */
export const preprocessText = (text) => {
  if (typeof text !== 'string') return '';

  // Trim whitespace
  let processed = text.trim();

  // Remove excessive whitespace
  processed = processed.replace(/\s+/g, ' ');

  // Basic sanitization - remove potentially harmful characters
  processed = processed.replace(/[<>\"'&]/g, '');

  // Limit length to prevent abuse
  if (processed.length > 10000) {
    processed = processed.substring(0, 10000) + '...';
  }

  return processed;
};

/**
 * Preprocesses single choice answers
 * @param {string} answer - Raw answer
 * @returns {string|null} Processed answer
 */
export const preprocessSingleChoice = (answer) => {
  if (typeof answer !== 'string') return null;

  const processed = preprocessText(answer);
  return processed || null;
};

/**
 * Preprocesses multiple choice (checkbox) answers
 * @param {Array|string} answers - Raw answers
 * @returns {Array} Processed answers array
 */
export const preprocessMultipleChoice = (answers) => {
  if (!Array.isArray(answers)) {
    // Handle case where single value is passed
    if (typeof answers === 'string' && answers.trim()) {
      return [preprocessText(answers)];
    }
    return [];
  }

  // Filter out empty values and preprocess each
  return answers
    .filter(answer => answer && typeof answer === 'string' && answer.trim())
    .map(answer => preprocessText(answer))
    .filter(answer => answer.length > 0);
};

/**
 * Preprocesses date inputs
 * @param {string} dateString - Raw date string
 * @returns {string|null} Processed date string
 */
export const preprocessDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;

  try {
    // Validate date format (YYYY-MM-DD)
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    // Ensure date is not in the future (with some buffer for timezone)
    const now = new Date();
    const maxFutureDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now

    if (date > maxFutureDate) return null;

    // Return in ISO format
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
};

/**
 * Preprocesses rating inputs
 * @param {number|string} rating - Raw rating value
 * @returns {number|null} Processed rating (1-5)
 */
export const preprocessRating = (rating) => {
  const numRating = typeof rating === 'string' ? parseInt(rating, 10) : rating;

  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return null;
  }

  return numRating;
};

// ================================
// MACHINE LEARNING PREPROCESSING
// ================================

/**
 * Comprehensive text preprocessing pipeline for ML models
 * @param {string} text - Raw text input
 * @returns {Object} Preprocessed text data with ML features
 */
export const preprocessTextForML = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return {
      original: '',
      cleaned: '',
      tokens: [],
      features: {
        wordCount: 0,
        charCount: 0,
        avgWordLength: 0,
        uniqueWords: 0,
        lexicalDiversity: 0,
        positiveWordCount: 0,
        negativeWordCount: 0,
        sentimentScore: 0,
        isQuestion: false,
        hasNumbers: false,
        hasEmails: false,
        hasUrls: false,
        readabilityScore: 0
      }
    };
  }

  const original = text;
  let cleaned = text;

  // 1. Text Cleaning
  cleaned = cleanTextForML(cleaned);

  // 2. Tokenization
  const tokens = tokenizeText(cleaned);

  // 3. Normalization
  const normalizedTokens = normalizeTokens(tokens);

  // 4. Stopword Removal
  const filteredTokens = removeStopwords(normalizedTokens);

  // 5. Feature Extraction
  const features = extractMLFeatures(filteredTokens, cleaned, original);

  return {
    original,
    cleaned,
    tokens: filteredTokens,
    features
  };
};

/**
 * Advanced text cleaning for ML processing
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
export const cleanTextForML = (text) => {
  if (!text) return '';

  let cleaned = text.toLowerCase().trim();

  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ' [URL] ');

  // Remove email addresses
  cleaned = cleaned.replace(/\S+@\S+\.\S+/g, ' [EMAIL] ');

  // Remove phone numbers (basic pattern)
  cleaned = cleaned.replace(/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, ' [PHONE] ');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove excessive punctuation but keep basic punctuation
  cleaned = cleaned.replace(/[^\w\s.,!?-]/g, ' ');

  // Remove extra whitespace again
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
};

/**
 * Tokenizes text into meaningful words
 * @param {string} text - Cleaned text
 * @returns {Array<string>} Array of tokens
 */
export const tokenizeText = (text) => {
  if (!text) return [];

  // Split on whitespace and keep punctuation as separate tokens when meaningful
  const tokens = text.split(/\s+/).filter(token => token.length > 0);

  // Further split on punctuation for better tokenization
  const refinedTokens = [];
  tokens.forEach(token => {
    // Split on punctuation but keep it attached to words
    const parts = token.split(/([.,!?])/).filter(part => part.length > 0);
    refinedTokens.push(...parts);
  });

  return refinedTokens.filter(token => token.length > 0);
};

/**
 * Normalizes tokens using stemming and lemmatization approximations
 * @param {Array<string>} tokens - Raw tokens
 * @returns {Array<string>} Normalized tokens
 */
export const normalizeTokens = (tokens) => {
  const normalized = tokens.map(token => {
    let normalized = token;

    // Remove common suffixes (basic stemming)
    if (normalized.length > 3) {
      // Plural forms
      if (normalized.endsWith('ies')) {
        normalized = normalized.slice(0, -3) + 'y';
      } else if (normalized.endsWith('es') && !normalized.endsWith('sses') && !normalized.endsWith('ies')) {
        normalized = normalized.slice(0, -2);
      } else if (normalized.endsWith('s') && !normalized.endsWith('ss') && !normalized.endsWith('us')) {
        normalized = normalized.slice(0, -1);
      }

      // Verb endings
      if (normalized.endsWith('ing')) {
        normalized = normalized.slice(0, -3);
      } else if (normalized.endsWith('ed')) {
        normalized = normalized.slice(0, -2);
      } else if (normalized.endsWith('er')) {
        normalized = normalized.slice(0, -2);
      } else if (normalized.endsWith('est')) {
        normalized = normalized.slice(0, -3);
      }

      // Adjective endings
      if (normalized.endsWith('ly')) {
        normalized = normalized.slice(0, -2);
      }
    }

    return normalized;
  });

  return normalized;
};

/**
 * Removes common English stopwords
 * @param {Array<string>} tokens - Tokens to filter
 * @returns {Array<string>} Filtered tokens
 */
export const removeStopwords = (tokens) => {
  const stopwords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'i', 'you', 'he', 'she', 'it', 'we',
    'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'its', 'our', 'their', 'this', 'that', 'these', 'those', 'am',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'shall'
  ]);

  return tokens.filter(token =>
    !stopwords.has(token.toLowerCase()) &&
    token.length > 1 &&
    !/^\d+$/.test(token) // Remove pure numbers
  );
};

/**
 * Extracts comprehensive ML features from processed text
 * @param {Array<string>} tokens - Filtered tokens
 * @param {string} cleanedText - Cleaned text
 * @param {string} originalText - Original text
 * @returns {Object} Feature object
 */
export const extractMLFeatures = (tokens, cleanedText, originalText) => {
  const features = {
    wordCount: tokens.length,
    charCount: cleanedText.length,
    avgWordLength: tokens.length > 0 ? cleanedText.replace(/\s/g, '').length / tokens.length : 0,
    uniqueWords: new Set(tokens).size,
    lexicalDiversity: tokens.length > 0 ? new Set(tokens).size / tokens.length : 0
  };

  // Sentiment Analysis
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'best', 'awesome', 'happy', 'pleased', 'satisfied', 'perfect', 'brilliant'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'disappoint', 'poor', 'fail', 'broken', 'sad', 'angry', 'frustrated', 'annoyed', 'disgusted'];

  features.positiveWordCount = tokens.filter(token =>
    positiveWords.some(word => token.toLowerCase().includes(word))
  ).length;

  features.negativeWordCount = tokens.filter(token =>
    negativeWords.some(word => token.toLowerCase().includes(word))
  ).length;

  features.sentimentScore = features.positiveWordCount - features.negativeWordCount;

  // Question Detection
  features.isQuestion = originalText.includes('?') ||
    originalText.toLowerCase().startsWith('what') ||
    originalText.toLowerCase().startsWith('how') ||
    originalText.toLowerCase().startsWith('why') ||
    originalText.toLowerCase().startsWith('when') ||
    originalText.toLowerCase().startsWith('where') ||
    originalText.toLowerCase().startsWith('who') ||
    originalText.toLowerCase().startsWith('which');

  // Content Type Detection
  features.hasNumbers = /\d/.test(originalText);
  features.hasEmails = /\S+@\S+\.\S+/.test(originalText);
  features.hasUrls = /https?:\/\/[^\s]+/.test(originalText);

  // Readability Score (simplified)
  const sentences = originalText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgWordsPerSentence = sentences.length > 0 ? tokens.length / sentences.length : 0;
  features.readabilityScore = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 10) * 2));

  // Additional ML features
  features.longWords = tokens.filter(token => token.length > 6).length;
  features.shortWords = tokens.filter(token => token.length <= 3).length;
  features.capitalWords = tokens.filter(token => token[0] === token[0].toUpperCase()).length;

  return features;
};

/**
 * Preprocesses all form responses for ML analysis
 * @param {Array} responses - Array of response objects
 * @param {Array} questions - Form questions
 * @returns {Array} Preprocessed responses with ML features
 */
export const preprocessResponsesForML = (responses, questions) => {
  return responses.map(response => {
    const processedResponse = { ...response };

    questions.forEach(question => {
      const answer = response.answers?.find(a => a.question_id === question.id);

      if (answer && (question.type === 'short_text' || question.type === 'long_text')) {
        const mlProcessed = preprocessTextForML(answer.answer);
        processedResponse[`${question.id}_ml`] = mlProcessed;
      }
    });

    return processedResponse;
  });
};

/**
 * Generates TF-IDF features for text corpus
 * @param {Array<string>} documents - Array of text documents
 * @returns {Object} TF-IDF matrix and vocabulary
 */
export const generateTFIDF = (documents) => {
  const processedDocs = documents.map(doc => preprocessTextForML(doc));
  const allTokens = new Set();

  // Collect all unique tokens
  processedDocs.forEach(doc => {
    doc.tokens.forEach(token => allTokens.add(token));
  });

  const vocabulary = Array.from(allTokens);
  const tfidfMatrix = [];

  processedDocs.forEach((doc, docIndex) => {
    const tfidfVector = new Array(vocabulary.length).fill(0);

    // Calculate TF
    const tokenCounts = {};
    doc.tokens.forEach(token => {
      tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    });

    // Calculate TF-IDF
    vocabulary.forEach((token, tokenIndex) => {
      const tf = tokenCounts[token] || 0;
      const df = processedDocs.filter(d => d.tokens.includes(token)).length;
      const idf = Math.log(processedDocs.length / (df || 1));
      tfidfVector[tokenIndex] = tf * idf;
    });

    tfidfMatrix.push({
      document: docIndex,
      vector: tfidfVector,
      tokens: doc.tokens,
      features: doc.features
    });
  });

  return {
    vocabulary,
    matrix: tfidfMatrix,
    documents: processedDocs
  };
};

/**
 * Analyzes sentiment across multiple responses
 * @param {Array} responses - Array of ML processed responses
 * @returns {Object} Sentiment analysis results
 */
export const analyzeSentiment = (responses) => {
  const sentiments = responses.map(r => {
    const mlData = Object.values(r).find(val => val && val.features);
    return mlData ? mlData.features.sentimentScore : 0;
  });

  const avgSentiment = sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
  const positiveCount = sentiments.filter(s => s > 0).length;
  const negativeCount = sentiments.filter(s => s < 0).length;
  const neutralCount = sentiments.filter(s => s === 0).length;

  return {
    averageSentiment: avgSentiment,
    positiveResponses: positiveCount,
    negativeResponses: negativeCount,
    neutralResponses: neutralCount,
    totalResponses: sentiments.length,
    sentimentDistribution: {
      positive: positiveCount / sentiments.length,
      negative: negativeCount / sentiments.length,
      neutral: neutralCount / sentiments.length
    }
  };
};

/**
 * Extracts keywords and topics from responses
 * @param {Array} responses - Array of ML processed responses
 * @param {number} topN - Number of top keywords to extract
 * @returns {Array} Top keywords with frequencies
 */
export const extractKeywords = (responses, topN = 10) => {
  const keywordCounts = {};

  responses.forEach(response => {
    const mlData = Object.values(response).find(val => val && val.tokens);
    if (mlData && mlData.tokens) {
      mlData.tokens.forEach(token => {
        keywordCounts[token] = (keywordCounts[token] || 0) + 1;
      });
    }
  });

  return Object.entries(keywordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, topN)
    .map(([keyword, count]) => ({ keyword, count }));
};

/**
 * Performs comprehensive ML analysis on form responses
 * @param {Array} responses - Raw responses
 * @param {Array} questions - Form questions
 * @returns {Object} Complete ML analysis results
 */
export const performMLAnalysis = (responses, questions) => {
  const textQuestions = questions.filter(q => q.type === 'short_text' || q.type === 'long_text');

  if (textQuestions.length === 0) {
    return {
      hasTextQuestions: false,
      analysis: null
    };
  }

  // Preprocess all responses
  const mlProcessedResponses = preprocessResponsesForML(responses, questions);

  // Extract all text responses for corpus analysis
  const textCorpus = [];
  responses.forEach(response => {
    textQuestions.forEach(question => {
      const answer = response.answers?.find(a => a.question_id === question.id);
      if (answer && answer.answer) {
        textCorpus.push(answer.answer);
      }
    });
  });

  // Generate TF-IDF
  const tfidf = generateTFIDF(textCorpus);

  // Sentiment analysis
  const sentimentAnalysis = analyzeSentiment(mlProcessedResponses);

  // Keyword extraction
  const keywords = extractKeywords(mlProcessedResponses);

  // Question analysis
  const questionAnalysis = mlProcessedResponses.reduce((acc, response) => {
    const mlData = Object.values(response).find(val => val && val.features);
    if (mlData && mlData.features.isQuestion) {
      acc.questionCount++;
    }
    return acc;
  }, { questionCount: 0 });

  return {
    hasTextQuestions: true,
    analysis: {
      totalResponses: responses.length,
      textQuestionsCount: textQuestions.length,
      sentimentAnalysis,
      keywords,
      questionAnalysis,
      tfidf,
      processedResponses: mlProcessedResponses
    }
  };
};

/**
 * Preprocesses form data before creation/update
 * @param {Object} formData - Raw form data
 * @returns {Object} Processed form data
 */
export const preprocessFormData = (formData) => {
  const processed = { ...formData };

  // Preprocess title
  if (processed.title) {
    processed.title = preprocessText(processed.title);
  }

  // Preprocess description
  if (processed.description) {
    processed.description = preprocessText(processed.description);
  }

  // Preprocess questions
  if (processed.questions && Array.isArray(processed.questions)) {
    processed.questions = processed.questions.map(question => ({
      ...question,
      code: question.code || '', // PRESERVE CODE FIELD
      title: preprocessText(question.title || ''),
      description: question.description ? preprocessText(question.description) : '',
      options: question.options ? question.options.map(opt => preprocessText(opt)) : []
    }));
  }

  return processed;
};

/**
 * Validates preprocessed data
 * @param {Object} answers - Preprocessed answers
 * @param {Array} questions - Form questions
 * @returns {Object} Validation result { isValid: boolean, errors: Array }
 */
export const validatePreprocessedData = (answers, questions) => {
  const errors = [];

  questions.forEach(question => {
    const answer = answers[question.id];

    // Check required fields
    if (question.required) {
      if (answer === null || answer === undefined ||
          (Array.isArray(answer) && answer.length === 0) ||
          (typeof answer === 'string' && answer.trim() === '')) {
        errors.push(`Question "${question.title}" is required`);
      }
    }

    // Type-specific validation
    if (answer !== null && answer !== undefined) {
      switch (question.type) {
        case 'multiple_choice':
        case 'dropdown':
          if (question.options && !question.options.includes(answer)) {
            errors.push(`Invalid answer for "${question.title}"`);
          }
          break;

        case 'checkboxes':
          if (!Array.isArray(answer)) {
            errors.push(`Invalid answer format for "${question.title}"`);
          } else if (question.options) {
            const invalidOptions = answer.filter(opt => !question.options.includes(opt));
            if (invalidOptions.length > 0) {
              errors.push(`Invalid options selected for "${question.title}"`);
            }
          }
          break;

        case 'date':
          if (typeof answer !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(answer)) {
            errors.push(`Invalid date format for "${question.title}"`);
          }
          break;

        case 'rating':
          if (typeof answer !== 'number' || answer < 1 || answer > 5) {
            errors.push(`Invalid rating for "${question.title}"`);
          }
          break;
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitizes HTML content (basic XSS prevention)
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== 'string') return '';

  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  return sanitized;
};

/**
 * Generates standardized CSV headers from questionnaire
 * Following format: [SECTION][##]_[##][SUFFIX]_[DESCRIPTION]
 * @param {Array} questions - Form questions with code field
 * @returns {Array} Array of column header strings
 */
export const generateAssessmentHeaders = (questions) => {
  const headers = ['RESPONDENT_ID', 'A01:CONSENT'];
  
  questions.forEach(question => {
    if (!question.code) return; // Skip questions without codes
    
    // Parse question code (e.g., "B01.01", "D01.02A", "C03")
    const code = question.code.trim();
    
    // Replace dots with underscores
    const normalizedCode = code.replace(/\./g, '_');
    
    // Check if multiple-choice/checkboxes
    if (question.type === 'checkboxes' && question.options) {
      // Split into separate columns per option
      question.options.forEach((option, idx) => {
        const optionNum = String(idx + 1).padStart(2, '0');
        const columnName = `${normalizedCode}_${optionNum}`;
        headers.push(columnName);
      });
    } else {
      // Single column
      headers.push(normalizedCode);
    }
  });
  
  return headers;
};

/**
 * Maps response data to General Assessment CSV columns
 * @param {Object} response - Response object
 * @param {Array} questions - Form questions
 * @param {Array} headers - Generated headers array
 * @param {number} index - Response index (0-based)
 * @returns {Array} Array of values matching header order
 */
export const mapResponseToAssessmentColumns = (response, questions, headers, index) => {
  const row = [];
  
  // Helper: Get raw answer by question code
  const getAnswerByCode = (code) => {
    const question = questions.find(q => q.code === code);
    if (!question) return null;
    
    // Add null-safety for response.answers
    const answers = response.answers || [];
    const ans = answers.find(a => a.question_id === question.id);
    
    return ans ? ans.answer : null;
  };
  
  // Process each header
  headers.forEach(header => {
    if (header === 'RESPONDENT_ID') {
      row.push(`GA-${String(index + 1).padStart(3, '0')}`);
      return;
    }
    
    if (header === 'A01:CONSENT') {
      const consent = getAnswerByCode('A01');
      row.push(consent || '');
      return;
    }
    
    // Find matching question by code
    // Extract base code from header (remove option suffix if present)
    let matchedValue = '';
    
    for (const question of questions) {
      if (!question.code) continue;
      
      const normalizedCode = question.code.replace(/\./g, '_');
      
      if (question.type === 'checkboxes') {
        // Check if header matches this question's option column
        if (header.startsWith(normalizedCode + '_')) {
          const answer = getAnswerByCode(question.code);
          
          // Extract option index from header
          const optionMatch = header.match(/_([0-9]+)$/);
          if (optionMatch && question.options) {
            const optionIdx = parseInt(optionMatch[1], 10) - 1;
            const optionValue = question.options[optionIdx];
            
            // Check if this option was selected
            if (Array.isArray(answer)) {
              matchedValue = answer.includes(optionValue) ? '1' : '0';
            } else {
              matchedValue = '0';
            }
          }
          break;
        }
      } else {
        // Single-value question
        if (header === normalizedCode || header.startsWith(normalizedCode + '_')) {
          const answer = getAnswerByCode(question.code);
          
          if (answer === null || answer === undefined) {
            matchedValue = '';
          } else if (Array.isArray(answer)) {
            matchedValue = answer.join(';');
          } else {
            matchedValue = String(answer);
          }
          break;
        }
      }
    }
    
    row.push(matchedValue);
  });
  
  return row;
};

/**
 * Preprocesses analytics data
 * @param {Object} analyticsData - Raw analytics data
 * @returns {Object} Processed analytics data
 */
export const preprocessAnalyticsData = (analyticsData) => {
  // Ensure numeric values are properly typed
  const processed = { ...analyticsData };

  if (processed.total_responses !== undefined) {
    processed.total_responses = Number(processed.total_responses) || 0;
  }

  if (processed.questions && Array.isArray(processed.questions)) {
    processed.questions = processed.questions.map(question => ({
      ...question,
      type: question.type || 'unknown',
      title: preprocessText(question.title || ''),
      responses: Array.isArray(question.responses) ? question.responses : []
    }));
  }

  return processed;
};