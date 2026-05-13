import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useAuth } from '../hooks/useAuth';
import { useUpdateUser } from '../hooks/useUser';
import { useNearbyStores } from '../hooks/useStores';
import { useTrack } from '../hooks/useTrack';
import { PlusIcon } from '../theme/icons/PlusIcon';
import { CloseIcon } from '../theme/icons/CloseIcon';
import { colors, fonts, fontWeights, radii, spacing } from '../theme/tokens';
import type {
  HouseholdMember,
  MemberAgeBracket,
  CookingEffort,
  KidAgeBracket,
  MaxStores,
} from '@groceryhack/shared/types';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const DIETARY_OPTIONS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free',
  'halal', 'kosher', 'shellfish-free', 'egg-free', 'soy-free', 'low-sodium',
] as const;

const AGE_BRACKETS: { value: MemberAgeBracket; label: string }[] = [
  { value: 'under_2', label: 'Under 2' },
  { value: 'picky_2_5', label: '2-5' },
  { value: 'expanding_6_12', label: '6-12' },
  { value: 'teen_13_plus', label: '13+' },
  { value: 'adult', label: 'Adult' },
];

const EFFORT_OPTIONS: { value: CookingEffort; label: string; desc: string }[] = [
  { value: 'quick', label: 'Quick & Easy', desc: 'Under 30 minutes total' },
  { value: 'moderate', label: 'Balanced', desc: 'Under 60 minutes total' },
  { value: 'ambitious', label: 'Best Recipes', desc: 'No time limit' },
];

const KID_BRACKETS: ReadonlySet<string> = new Set(['under_2', 'picky_2_5', 'expanding_6_12', 'teen_13_plus']);

function formatDietaryLabel(d: string): string {
  return d.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

function getKidEffectText(bracket: KidAgeBracket, name: string): string {
  switch (bracket) {
    case 'under_2': return `${name}: Baby food deals tracked`;
    case 'picky_2_5': return `${name} (age 2-5): Kid-friendly meals prioritized`;
    case 'expanding_6_12': return `${name} (age 6-12): Expanding palate meals included`;
    case 'teen_13_plus': return `${name} (age 13+): Teen-sized portions`;
    default: return '';
  }
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps): React.ReactElement {
  const { user } = useAuth();
  const { mutate: updateUser, isPending } = useUpdateUser();
  const { track } = useTrack();

  // Local draft state — only saved on explicit submit
  const [members, setMembers] = useState<HouseholdMember[]>(user?.householdMembers ?? []);
  const [dietary, setDietary] = useState<string[]>(user?.dietaryRestrictions ?? []);
  const [effort, setEffort] = useState<CookingEffort>(user?.cookingEffort ?? 'moderate');
  const [maxStores, setMaxStores] = useState<MaxStores>(user?.maxStores ?? 1);

  // New member form
  const [addingMember, setAddingMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBracket, setNewBracket] = useState<MemberAgeBracket>('adult');

  // Sync from user when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setMembers(user.householdMembers ?? []);
      setDietary(user.dietaryRestrictions ?? []);
      setEffort(user.cookingEffort ?? 'moderate');
      setMaxStores(user.maxStores ?? 1);
      setAddingMember(false);
      setNewName('');
      setNewBracket('adult');
    }
  }, [isOpen, user]);

  // Track opening
  useEffect(() => {
    if (isOpen) {
      track('settings_opened');
    }
  }, [isOpen, track]);

  const postalCode = user?.postalCode ?? '';
  const { data: nearbyStores } = useNearbyStores(postalCode);

  // Detect if anything changed from the saved user state
  const hasChanges = useMemo(() => {
    if (!user) return false;
    const membersChanged = JSON.stringify(members) !== JSON.stringify(user.householdMembers ?? []);
    const dietaryChanged = JSON.stringify(dietary) !== JSON.stringify(user.dietaryRestrictions ?? []);
    const effortChanged = effort !== (user.cookingEffort ?? 'moderate');
    const storesChanged = maxStores !== (user.maxStores ?? 1);
    return membersChanged || dietaryChanged || effortChanged || storesChanged;
  }, [user, members, dietary, effort, maxStores]);

  // Derive kid brackets and member dietary notes
  const kidBrackets = useMemo(() => {
    return [...new Set(
      members
        .map(m => m.ageBracket)
        .filter(b => KID_BRACKETS.has(b))
    )] as KidAgeBracket[];
  }, [members]);

  const memberDietaryNotes = useMemo(() => {
    const notes: string[] = [];
    for (const m of members) {
      for (const d of m.dietaryRestrictions) {
        notes.push(`${m.name} is ${d}`);
      }
    }
    return notes;
  }, [members]);

  // ── Handlers ──

  const handleAddMember = useCallback(() => {
    if (!newName.trim()) return;
    const member: HouseholdMember = {
      name: newName.trim(),
      ageBracket: newBracket,
      dietaryRestrictions: [],
    };
    setMembers(prev => [...prev, member]);
    setAddingMember(false);
    setNewName('');
    setNewBracket('adult');
    track('household_member_added', { age_bracket: newBracket });
  }, [newName, newBracket, track]);

  const handleRemoveMember = useCallback((index: number) => {
    const removed = members[index];
    setMembers(prev => prev.filter((_, i) => i !== index));
    if (removed) {
      track('household_member_removed', { age_bracket: removed.ageBracket });
    }
  }, [members, track]);

  const handleDietaryToggle = useCallback((restriction: string) => {
    const enabled = !dietary.includes(restriction);
    setDietary(prev =>
      enabled ? [...prev, restriction] : prev.filter(d => d !== restriction)
    );
    track('dietary_restriction_toggled', { restriction, enabled });
  }, [dietary, track]);

  const handleEffortChange = useCallback((newEffort: CookingEffort) => {
    track('cooking_effort_changed', { from: effort, to: newEffort });
    setEffort(newEffort);
  }, [effort, track]);

  const handleMaxStoresChange = useCallback((newMax: MaxStores) => {
    track('max_stores_changed', { from: maxStores, to: newMax });
    setMaxStores(newMax);
  }, [maxStores, track]);

  const handleSave = useCallback(() => {
    updateUser({
      householdMembers: members,
      dietaryRestrictions: dietary,
      cookingEffort: effort,
      maxStores,
    });
    onClose();
  }, [updateUser, members, dietary, effort, maxStores, onClose]);

  const householdSize = members.length + 1;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="Settings">
      <div style={s.container}>

        {/* ═══ Section 1: Household Members ═══ */}
        <section style={s.section}>
          <h3 style={s.sectionTitle}>Household Members</h3>
          <p style={s.sectionSubtext}>
            {householdSize} {householdSize === 1 ? 'person' : 'people'} in household (including you)
          </p>

          <div style={s.memberList}>
            {members.map((member, index) => (
              <div key={`${member.name}-${index}`} style={s.memberRow}>
                <div style={s.memberInfo}>
                  <span style={s.memberName}>{member.name}</span>
                  <span style={s.memberBracketPill}>
                    {AGE_BRACKETS.find(b => b.value === member.ageBracket)?.label ?? member.ageBracket}
                  </span>
                  {member.dietaryRestrictions.map(d => (
                    <span key={d} style={s.dietaryPill}>{formatDietaryLabel(d)}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(index)}
                  style={s.removeBtn}
                  aria-label={`Remove ${member.name}`}
                >
                  <CloseIcon size={16} color={colors.textMuted} />
                </button>
              </div>
            ))}
          </div>

          {addingMember ? (
            <div style={s.addForm}>
              <input
                type="text"
                placeholder="Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={s.input}
                autoFocus
              />
              <div style={s.segmentedRow}>
                {AGE_BRACKETS.map(b => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setNewBracket(b.value)}
                    style={{
                      ...s.segmentBtn,
                      ...(newBracket === b.value ? s.segmentBtnActive : {}),
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div style={s.addFormActions}>
                <button type="button" onClick={handleAddMember} style={s.primaryBtn}>
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingMember(false); setNewName(''); }}
                  style={s.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingMember(true)} style={s.addMemberBtn}>
              <PlusIcon size={18} color={colors.primary} />
              <span>Add member</span>
            </button>
          )}
        </section>

        {/* ═══ Section 2: Dietary Restrictions ═══ */}
        <section style={s.section}>
          <h3 style={s.sectionTitle}>Dietary Restrictions</h3>
          {memberDietaryNotes.length > 0 && (
            <p style={s.dietaryNote}>
              {memberDietaryNotes.join(' · ')} — meals will also exclude these
            </p>
          )}
          <div style={s.toggleGrid}>
            {DIETARY_OPTIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDietaryToggle(d)}
                style={{
                  ...s.toggleBtn,
                  ...(dietary.includes(d) ? s.toggleBtnActive : {}),
                }}
              >
                {formatDietaryLabel(d)}
              </button>
            ))}
          </div>
        </section>

        {/* ═══ Section 3: Cooking Style ═══ */}
        <section style={s.section}>
          <h3 style={s.sectionTitle}>Cooking Style</h3>
          <div style={s.effortCards}>
            {EFFORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleEffortChange(opt.value)}
                style={{
                  ...s.effortCard,
                  borderColor: effort === opt.value ? colors.primary : colors.primaryLight,
                  boxShadow: effort === opt.value ? `0 0 0 3px ${colors.primaryLight}` : 'none',
                }}
              >
                <span style={s.effortLabel}>{opt.label}</span>
                <span style={s.effortDesc}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ═══ Section 4: Store Preferences ═══ */}
        <section style={s.section}>
          <h3 style={s.sectionTitle}>Store Preferences</h3>

          <div style={s.storeSegmented}>
            <button
              type="button"
              onClick={() => handleMaxStoresChange(1)}
              style={{
                ...s.segmentBtn,
                ...(maxStores === 1 ? s.segmentBtnActive : {}),
                flex: 1,
              }}
            >
              1 Store
            </button>
            <button
              type="button"
              onClick={() => handleMaxStoresChange(2)}
              style={{
                ...s.segmentBtn,
                ...(maxStores === 2 ? s.segmentBtnActive : {}),
                flex: 1,
              }}
            >
              2 Stores
            </button>
          </div>

          {nearbyStores && nearbyStores.length > 0 && (
            <div style={s.storeList}>
              {nearbyStores.slice(0, 8).map(store => (
                <div key={store.id} style={s.storeRow}>
                  <div>
                    <span style={s.storeName}>{store.brandName}</span>
                    <span style={s.storeDistance}>
                      {store.distanceKm !== undefined ? `${store.distanceKm.toFixed(1)} km` : ''}
                    </span>
                  </div>
                  <span style={s.storeAddress}>{store.address}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══ Section 5: Kids Summary (only shown when kids exist) ═══ */}
        {kidBrackets.length > 0 && (
          <section style={s.section}>
            <h3 style={s.sectionTitle}>Kids Summary</h3>
            <div style={s.kidsSummary}>
              {members
                .filter(m => KID_BRACKETS.has(m.ageBracket))
                .map((m, i) => (
                  <p key={`${m.name}-${i}`} style={s.kidEffect}>
                    {getKidEffectText(m.ageBracket as KidAgeBracket, m.name)}
                  </p>
                ))}
            </div>
          </section>
        )}

        {/* ═══ Save Button ═══ */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isPending}
          style={{
            ...s.submitBtn,
            ...(!hasChanges ? s.submitBtnDisabled : {}),
          }}
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    paddingBottom: '8px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontWeight: fontWeights.bold,
    fontSize: '1.1rem',
    color: colors.text,
    margin: 0,
  },
  sectionSubtext: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: '0.85rem',
    color: colors.textMuted,
    margin: 0,
  },

  // ── Members ──
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    backgroundColor: colors.bg,
    borderRadius: radii.input,
    gap: '8px',
  },
  memberInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  memberName: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    fontSize: '0.9rem',
    color: colors.text,
  },
  memberBracketPill: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.75rem',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    padding: '2px 10px',
  },
  dietaryPill: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.7rem',
    color: colors.textMuted,
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.pill,
    padding: '2px 8px',
  },
  removeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '50%',
    padding: 0,
    flexShrink: 0,
  },
  addMemberBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    fontSize: '0.9rem',
    color: colors.primary,
    background: 'none',
    border: `1.5px dashed ${colors.border}`,
    borderRadius: radii.input,
    padding: '12px 16px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
  },
  addForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    backgroundColor: colors.bg,
    borderRadius: radii.input,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    padding: '10px 14px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    outline: 'none',
    backgroundColor: colors.white,
    minHeight: spacing.touchTargetMin,
  },
  segmentedRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  segmentBtn: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.8rem',
    color: colors.textMuted,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.pill,
    padding: '8px 14px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
    transition: 'all 0.2s ease',
  },
  segmentBtnActive: {
    color: colors.white,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  addFormActions: {
    display: 'flex',
    gap: '8px',
  },
  primaryBtn: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    fontSize: '0.9rem',
    color: colors.white,
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: radii.pill,
    padding: '10px 24px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
  },
  cancelBtn: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.9rem',
    color: colors.textMuted,
    backgroundColor: 'transparent',
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.pill,
    padding: '10px 24px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
  },

  // ── Dietary toggles ──
  dietaryNote: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: '0.8rem',
    color: colors.primary,
    fontStyle: 'italic',
    margin: 0,
  },
  toggleGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  toggleBtn: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.85rem',
    color: colors.textMuted,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.pill,
    padding: '8px 16px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
    transition: 'all 0.2s ease',
  },
  toggleBtnActive: {
    color: colors.white,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // ── Cooking effort ──
  effortCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  effortCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '16px 20px',
    backgroundColor: colors.white,
    border: `2px solid ${colors.primaryLight}`,
    borderRadius: radii.card,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    minHeight: spacing.touchTargetMin,
    boxShadow: 'none',
  },
  effortLabel: {
    fontFamily: fonts.heading,
    fontWeight: fontWeights.semibold,
    fontSize: '1rem',
    color: colors.text,
  },
  effortDesc: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: '0.85rem',
    color: colors.textMuted,
  },

  // ── Stores ──
  storeSegmented: {
    display: 'flex',
    gap: '4px',
  },
  storeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
  },
  storeRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '10px 14px',
    backgroundColor: colors.bg,
    borderRadius: radii.input,
  },
  storeName: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    fontSize: '0.9rem',
    color: colors.text,
    marginRight: '8px',
  },
  storeDistance: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: '0.8rem',
    color: colors.textMuted,
  },
  storeAddress: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: '0.8rem',
    color: colors.textMuted,
  },

  // ── Kids summary ──
  kidsSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  kidEffect: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: '0.85rem',
    color: colors.text,
    margin: 0,
    padding: '8px 14px',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.input,
  },

  // ── Submit ──
  submitBtn: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    fontSize: '1rem',
    color: colors.white,
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: radii.pill,
    padding: '14px 28px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
    transition: 'all 0.2s ease',
    marginTop: '4px',
  },
  submitBtnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
};
