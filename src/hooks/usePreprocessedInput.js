// src/hooks/usePreprocessedInput.js
// Custom hook for real-time input preprocessing
import { useState, useCallback } from 'react';
import { preprocessText, preprocessDate, preprocessRating } from '../lib/preprocessing';

/**
 * Custom hook for preprocessed input handling
 * @param {string} initialValue - Initial value
 * @param {string} type - Input type ('text', 'date', 'rating', etc.)
 * @param {Object} options - Additional options
 * @returns {Object} { value, setValue, onChange, error }
 */
export const usePreprocessedInput = (initialValue = '', type = 'text', options = {}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(null);

  const preprocessValue = useCallback((rawValue) => {
    switch (type) {
      case 'text':
        return preprocessText(rawValue);

      case 'date':
        const processedDate = preprocessDate(rawValue);
        if (rawValue && !processedDate) {
          setError('Invalid date format');
          return rawValue; // Keep original for user to fix
        }
        setError(null);
        return processedDate || rawValue;

      case 'rating':
        const processedRating = preprocessRating(rawValue);
        if (rawValue && processedRating === null) {
          setError('Rating must be between 1 and 5');
          return rawValue;
        }
        setError(null);
        return processedRating !== null ? processedRating : rawValue;

      default:
        return rawValue;
    }
  }, [type]);

  const setValueWithPreprocessing = useCallback((newValue) => {
    const processed = preprocessValue(newValue);
    setValue(processed);
  }, [preprocessValue]);

  const onChange = useCallback((e) => {
    const inputValue = e.target.value;
    const processed = preprocessValue(inputValue);
    setValue(processed);
  }, [preprocessValue]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
  }, [initialValue]);

  return {
    value,
    setValue: setValueWithPreprocessing,
    onChange,
    error,
    reset,
    isValid: !error
  };
};

/**
 * Hook for preprocessed form state management
 * @param {Object} initialState - Initial form state
 * @param {Array} schema - Validation schema
 * @returns {Object} Form state and handlers
 */
export const usePreprocessedForm = (initialState = {}, schema = []) => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});

  const updateField = useCallback((fieldName, value, fieldType = 'text') => {
    let processedValue = value;

    // Apply preprocessing based on field type
    switch (fieldType) {
      case 'text':
        processedValue = preprocessText(value);
        break;
      case 'date':
        processedValue = preprocessDate(value);
        break;
      case 'rating':
        processedValue = preprocessRating(value);
        break;
      // Add more types as needed
    }

    setFormData(prev => ({
      ...prev,
      [fieldName]: processedValue
    }));

    // Clear error for this field if it exists
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    schema.forEach(field => {
      const value = formData[field.name];

      if (field.required && (!value || value === '')) {
        newErrors[field.name] = `${field.label} is required`;
      }

      if (value && field.validate) {
        const validationError = field.validate(value);
        if (validationError) {
          newErrors[field.name] = validationError;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, schema]);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setErrors({});
  }, [initialState]);

  return {
    formData,
    errors,
    updateField,
    validateForm,
    resetForm,
    isValid: Object.keys(errors).length === 0
  };
};