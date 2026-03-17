import React, { useState, useCallback, useEffect } from 'react';
import { colors, fonts, fontWeights, radii, shadows } from '../theme/tokens';
import { PlusIcon } from '../theme/icons/PlusIcon';
import { TrashIcon } from '../theme/icons/TrashIcon';
import { ModalOverlay } from './ModalOverlay';
import {
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
} from '../hooks/useRecipes';
import { useTrack } from '../hooks/useTrack';
import type {
  UserRecipe,
  UserRecipeCreate,
  Ingredient,
  Difficulty,
} from '@groceryhack/shared/types';

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: UserRecipe;
}

interface IngredientField {
  name: string;
  quantity: string;
  unit: string;
}

export function RecipeFormModal({
  isOpen,
  onClose,
  recipe,
}: RecipeFormModalProps): React.ReactElement {
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const deleteMutation = useDeleteRecipe();
  const { track } = useTrack();

  const isEditing = recipe !== undefined;

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [ingredients, setIngredients] = useState<IngredientField[]>([
    { name: '', quantity: '', unit: '' },
  ]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [tips, setTips] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (recipe) {
      setName(recipe.name);
      setTagline(recipe.tagline ?? '');
      setIngredients(
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
            }))
          : [{ name: '', quantity: '', unit: '' }]
      );
      setSteps(recipe.steps.length > 0 ? [...recipe.steps] : ['']);
      setPrepTime(recipe.prepTimeMinutes?.toString() ?? '');
      setCookTime(recipe.cookTimeMinutes?.toString() ?? '');
      setServings(recipe.servings?.toString() ?? '');
      setDifficulty(recipe.difficulty);
      setTips(recipe.tips ?? '');
      setIsPublic(recipe.isPublic);
    } else {
      resetForm();
    }
  }, [recipe, isOpen]);

  const resetForm = useCallback(() => {
    setName('');
    setTagline('');
    setIngredients([{ name: '', quantity: '', unit: '' }]);
    setSteps(['']);
    setPrepTime('');
    setCookTime('');
    setServings('');
    setDifficulty('easy');
    setTips('');
    setIsPublic(false);
    setShowDeleteConfirm(false);
  }, []);

  const handleAddIngredient = useCallback(() => {
    setIngredients((prev) => [...prev, { name: '', quantity: '', unit: '' }]);
  }, []);

  const handleRemoveIngredient = useCallback((index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleIngredientChange = useCallback(
    (index: number, field: keyof IngredientField, value: string) => {
      setIngredients((prev) =>
        prev.map((ingredient, i) =>
          i === index ? { ...ingredient, [field]: value } : ingredient
        )
      );
    },
    []
  );

  const handleAddStep = useCallback(() => {
    setSteps((prev) => [...prev, '']);
  }, []);

  const handleRemoveStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStepChange = useCallback((index: number, value: string) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? value : step)));
  }, []);

  const handleSave = useCallback(() => {
    const validIngredients: Ingredient[] = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity.trim(),
        unit: i.unit.trim(),
      }));

    if (!name.trim() || validIngredients.length === 0) return;

    const validSteps = steps.filter((s) => s.trim());

    const data: UserRecipeCreate = {
      name: name.trim(),
      ingredients: validIngredients,
      tagline: tagline.trim() || undefined,
      steps: validSteps.length > 0 ? validSteps : undefined,
      prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : undefined,
      cookTimeMinutes: cookTime ? parseInt(cookTime, 10) : undefined,
      servings: servings ? parseInt(servings, 10) : undefined,
      difficulty,
      tips: tips.trim() || undefined,
      isPublic,
    };

    if (isEditing && recipe) {
      updateMutation.mutate(
        { id: recipe.id, data },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: (result) => {
          track('recipe_created', {
            recipe_id: result.id,
            ingredient_count: validIngredients.length,
            is_public: isPublic,
          });
          resetForm();
          onClose();
        },
      });
    }
  }, [
    name,
    tagline,
    ingredients,
    steps,
    prepTime,
    cookTime,
    servings,
    difficulty,
    tips,
    isPublic,
    isEditing,
    recipe,
    createMutation,
    updateMutation,
    track,
    onClose,
    resetForm,
  ]);

  const handleDelete = useCallback(() => {
    if (!recipe) return;
    deleteMutation.mutate(recipe.id, {
      onSuccess: () => {
        track('recipe_deleted', { recipe_id: recipe.id });
        onClose();
      },
    });
  }, [recipe, deleteMutation, track, onClose]);

  const canSave =
    name.trim().length > 0 &&
    ingredients.some((i) => i.name.trim()) &&
    !createMutation.isPending &&
    !updateMutation.isPending;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Recipe' : 'New Recipe'}
    >
      <div style={styles.container}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="recipe-name">
            Recipe Name *
          </label>
          <input
            id="recipe-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What's this dish called?"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="recipe-tagline">
            Tagline
          </label>
          <input
            id="recipe-tagline"
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="A short description"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <div style={styles.sectionHeader}>
            <label style={styles.label}>Ingredients *</label>
            <button
              onClick={handleAddIngredient}
              style={styles.addSmallButton}
              aria-label="Add ingredient"
              type="button"
            >
              <PlusIcon size={16} color={colors.primary} />
              <span style={styles.addSmallText}>Add</span>
            </button>
          </div>
          <div style={styles.ingredientsList}>
            {ingredients.map((ingredient, index) => (
              <div key={index} style={styles.ingredientFieldRow}>
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) =>
                    handleIngredientChange(index, 'name', e.target.value)
                  }
                  placeholder="Ingredient"
                  style={styles.ingredientNameInput}
                  aria-label={`Ingredient ${index + 1} name`}
                />
                <input
                  type="text"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    handleIngredientChange(index, 'quantity', e.target.value)
                  }
                  placeholder="Qty"
                  style={styles.ingredientSmallInput}
                  aria-label={`Ingredient ${index + 1} quantity`}
                />
                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(e) =>
                    handleIngredientChange(index, 'unit', e.target.value)
                  }
                  placeholder="Unit"
                  style={styles.ingredientSmallInput}
                  aria-label={`Ingredient ${index + 1} unit`}
                />
                {ingredients.length > 1 && (
                  <button
                    onClick={() => handleRemoveIngredient(index)}
                    style={styles.removeButton}
                    aria-label={`Remove ingredient ${index + 1}`}
                    type="button"
                  >
                    <TrashIcon size={16} color={colors.danger} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.field}>
          <div style={styles.sectionHeader}>
            <label style={styles.label}>Steps</label>
            <button
              onClick={handleAddStep}
              style={styles.addSmallButton}
              aria-label="Add step"
              type="button"
            >
              <PlusIcon size={16} color={colors.primary} />
              <span style={styles.addSmallText}>Add</span>
            </button>
          </div>
          <div style={styles.stepsList}>
            {steps.map((step, index) => (
              <div key={index} style={styles.stepFieldRow}>
                <span style={styles.stepIndex}>{index + 1}</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => handleStepChange(index, e.target.value)}
                  placeholder={`Step ${index + 1}`}
                  style={styles.stepInput}
                  aria-label={`Step ${index + 1}`}
                />
                {steps.length > 1 && (
                  <button
                    onClick={() => handleRemoveStep(index)}
                    style={styles.removeButton}
                    aria-label={`Remove step ${index + 1}`}
                    type="button"
                  >
                    <TrashIcon size={16} color={colors.danger} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.optionalGrid}>
          <div style={styles.smallField}>
            <label style={styles.smallLabel} htmlFor="recipe-prep">
              Prep (min)
            </label>
            <input
              id="recipe-prep"
              type="number"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              placeholder="15"
              style={styles.smallInput}
              min="0"
            />
          </div>
          <div style={styles.smallField}>
            <label style={styles.smallLabel} htmlFor="recipe-cook">
              Cook (min)
            </label>
            <input
              id="recipe-cook"
              type="number"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              placeholder="30"
              style={styles.smallInput}
              min="0"
            />
          </div>
          <div style={styles.smallField}>
            <label style={styles.smallLabel} htmlFor="recipe-servings">
              Servings
            </label>
            <input
              id="recipe-servings"
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="4"
              style={styles.smallInput}
              min="1"
            />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Difficulty</label>
          <div style={styles.difficultyToggle}>
            <button
              onClick={() => setDifficulty('easy')}
              style={{
                ...styles.diffToggleButton,
                ...(difficulty === 'easy'
                  ? styles.diffToggleActive
                  : styles.diffToggleInactive),
              }}
              type="button"
            >
              Easy
            </button>
            <button
              onClick={() => setDifficulty('medium')}
              style={{
                ...styles.diffToggleButton,
                ...(difficulty === 'medium'
                  ? styles.diffToggleActive
                  : styles.diffToggleInactive),
              }}
              type="button"
            >
              Medium
            </button>
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="recipe-tips">
            Tips
          </label>
          <textarea
            id="recipe-tips"
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="Any tips or notes..."
            style={styles.textarea}
            rows={3}
          />
        </div>

        <div style={styles.publishRow}>
          <div style={styles.publishInfo}>
            <span style={styles.publishLabel}>Share with community</span>
            <span style={styles.publishHint}>
              {isPublic
                ? 'Your name will appear on this recipe'
                : 'Only visible to you'}
            </span>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            style={styles.publishToggleWrapper}
            aria-label={`${isPublic ? 'Unpublish' : 'Publish'} recipe`}
            type="button"
          >
            <div
              style={{
                ...styles.publishToggle,
                backgroundColor: isPublic ? colors.primary : colors.border,
              }}
            >
              <div
                style={{
                  ...styles.publishToggleKnob,
                  transform: isPublic
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </div>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...styles.saveButton,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
          type="button"
        >
          {isPending
            ? 'Saving...'
            : isEditing
              ? 'Save Changes'
              : 'Save Recipe'}
        </button>

        {isEditing && (
          <>
            {showDeleteConfirm ? (
              <div style={styles.deleteConfirm}>
                <p style={styles.deleteConfirmText}>
                  Delete this recipe? This cannot be undone.
                </p>
                <div style={styles.deleteConfirmActions}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={styles.cancelButton}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    style={styles.deleteConfirmButton}
                    type="button"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={styles.deleteButton}
                type="button"
              >
                Delete Recipe
              </button>
            )}
          </>
        )}

        {(createMutation.isError || updateMutation.isError) && (
          <p style={styles.errorText}>
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </ModalOverlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '12px 16px',
    outline: 'none',
    minHeight: 44,
    transition: 'border-color 0.2s ease',
  },
  addSmallButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    minHeight: 44,
  },
  addSmallText: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  ingredientsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  ingredientFieldRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  ingredientNameInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 12px',
    outline: 'none',
    minHeight: 44,
  },
  ingredientSmallInput: {
    width: 60,
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 8px',
    outline: 'none',
    minHeight: 44,
    flexShrink: 0,
    textAlign: 'center',
  },
  removeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 44,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  stepFieldRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  stepIndex: {
    fontFamily: fonts.heading,
    fontSize: '0.8rem',
    fontWeight: fontWeights.bold,
    color: colors.white,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 12px',
    outline: 'none',
    minHeight: 44,
  },
  optionalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  smallField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  smallLabel: {
    fontFamily: fonts.body,
    fontSize: '0.75rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
  },
  smallInput: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 12px',
    outline: 'none',
    minHeight: 44,
    textAlign: 'center',
  },
  difficultyToggle: {
    display: 'flex',
    backgroundColor: colors.white,
    border: `2px solid ${colors.primary}`,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  diffToggleButton: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    border: 'none',
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: 44,
  },
  diffToggleActive: {
    backgroundColor: colors.primary,
    color: colors.white,
  },
  diffToggleInactive: {
    backgroundColor: 'transparent',
    color: colors.textMuted,
  },
  textarea: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '12px 16px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.65,
    minHeight: 80,
  },
  publishRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: colors.bg,
    borderRadius: radii.card,
  },
  publishInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  publishLabel: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  publishHint: {
    fontFamily: fonts.body,
    fontSize: '0.75rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
  },
  publishToggleWrapper: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    position: 'relative',
    transition: 'background-color 0.2s ease',
  },
  publishToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: colors.white,
    position: 'absolute',
    top: 2,
    transition: 'transform 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },
  saveButton: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '14px 32px',
    boxShadow: shadows.button,
    minHeight: 44,
    transition: 'all 0.2s ease',
    marginTop: '4px',
  },
  deleteButton: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: 'transparent',
    color: colors.danger,
    border: 'none',
    borderRadius: radii.pill,
    padding: '12px 24px',
    cursor: 'pointer',
    minHeight: 44,
    transition: 'all 0.2s ease',
  },
  deleteConfirm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    backgroundColor: colors.dangerLight,
    borderRadius: radii.card,
  },
  deleteConfirmText: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.medium,
    color: colors.danger,
    margin: 0,
    textAlign: 'center',
  },
  deleteConfirmActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  cancelButton: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.white,
    color: colors.textMuted,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.pill,
    padding: '10px 24px',
    cursor: 'pointer',
    minHeight: 44,
  },
  deleteConfirmButton: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.danger,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '10px 24px',
    cursor: 'pointer',
    minHeight: 44,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.medium,
    color: colors.danger,
    margin: 0,
  },
};
