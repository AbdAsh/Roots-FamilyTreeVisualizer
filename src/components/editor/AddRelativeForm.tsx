import { useState, useMemo, useEffect } from 'react';
import { UserPlus, Users, Heart, GitBranch, Link } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n, t } from '@/lib/i18n';
import {
  getInferredRelationships,
  type InferredRelationship,
} from '@/lib/tree-utils';
import type { Gender } from '@/types/family';

type RelativeType = 'parent' | 'child' | 'spouse' | 'sibling';

interface AddRelativeFormProps {
  memberId: string;
  memberName: string;
}

export function AddRelativeForm({
  memberId,
  memberName,
}: AddRelativeFormProps) {
  const tree = useTreeStore((s) => s.tree);
  const addRelative = useTreeStore((s) => s.addRelative);
  const addRelationship = useTreeStore((s) => s.addRelationship);
  const selectMember = useTreeStore((s) => s.selectMember);
  const setEditing = useTreeStore((s) => s.setEditing);
  const { strings } = useI18n();

  const genderOptions = [
    { value: 'unknown', label: strings.editor.unknown },
    { value: 'male', label: strings.editor.male },
    { value: 'female', label: strings.editor.female },
    { value: 'other', label: strings.editor.other },
  ];

  const [activeType, setActiveType] = useState<RelativeType | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('unknown');
  const [enabledSuggestions, setEnabledSuggestions] = useState<Set<string>>(
    new Set(),
  );

  // Compute suggestions whenever type changes
  const suggestions: InferredRelationship[] = useMemo(() => {
    if (!activeType || !tree) return [];
    return getInferredRelationships(memberId, activeType, tree);
  }, [memberId, activeType, tree]);

  // Auto-enable all suggestions when the list changes (default ON)
  useEffect(() => {
    setEnabledSuggestions(new Set(suggestions.map((s) => s.key)));
  }, [suggestions]);

  const toggleSuggestion = (key: string) => {
    setEnabledSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    if (!activeType || !name.trim()) return;

    // 1. Create the primary relationship + member
    const newMember = addRelative(memberId, activeType, {
      name: name.trim(),
      gender,
      customFields: {},
    });

    // 2. Create any enabled inferred relationships
    for (const s of suggestions) {
      if (!enabledSuggestions.has(s.key)) continue;

      const from = s.newMemberIsFrom ? newMember.id : s.existingMemberId;
      const to = s.newMemberIsFrom ? s.existingMemberId : newMember.id;
      addRelationship(s.relType, from, to);
    }

    // 3. Reset form and select the new member for editing
    setName('');
    setGender('unknown');
    setActiveType(null);
    setEnabledSuggestions(new Set());
    selectMember(newMember.id);
    setEditing(true); // closes add panel + opens edit panel
  };

  const relativeTypes: {
    type: RelativeType;
    label: string;
    icon: typeof UserPlus;
    desc: string;
  }[] = [
    {
      type: 'parent',
      label: strings.addRelative.parent,
      icon: Users,
      desc: t(strings.addRelative.addParentOf, { name: memberName }),
    },
    {
      type: 'child',
      label: strings.addRelative.child,
      icon: GitBranch,
      desc: t(strings.addRelative.addChildOf, { name: memberName }),
    },
    {
      type: 'spouse',
      label: strings.addRelative.spouseLabel,
      icon: Heart,
      desc: t(strings.addRelative.addSpouseOf, { name: memberName }),
    },
    {
      type: 'sibling',
      label: strings.addRelative.sibling,
      icon: UserPlus,
      desc: t(strings.addRelative.addSiblingOf, { name: memberName }),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-medium text-cream/60 uppercase tracking-wider block">
        {strings.addRelative.title}
      </span>

      {/* Type selector buttons */}
      <div className="grid grid-cols-2 gap-2">
        {relativeTypes.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setActiveType(activeType === type ? null : type)}
            className={`
              flex items-center gap-2 px-3 py-2
              rounded-lg border text-xs font-medium
              transition-all duration-200 cursor-pointer
              ${
                activeType === type
                  ? 'bg-amber/10 border-amber/40 text-amber'
                  : 'bg-charcoal-light border-charcoal-lighter text-cream/60 hover:border-cream/20 hover:text-cream/80'
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Mini form when a type is selected */}
      {activeType && (
        <div className="flex flex-col gap-3 p-4 bg-charcoal-light/50 rounded-lg border border-charcoal-lighter animate-fade-in">
          <p className="text-[11px] text-cream/40">
            {relativeTypes.find((r) => r.type === activeType)?.desc}
          </p>

          <Input
            label={strings.addRelative.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder=""
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />

          <Select
            label={strings.editor.gender}
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
            options={genderOptions}
          />

          {/* Inferred relationship suggestions */}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <Link size={11} className="text-cream/40" />
                <span className="text-[10px] font-medium text-cream/40 uppercase tracking-wider">
                  {strings.addRelative.additionalRels}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s) => (
                  <label
                    key={s.key}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-charcoal/40 border border-charcoal-lighter hover:border-cream/15 transition-colors cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={enabledSuggestions.has(s.key)}
                      onChange={() => toggleSuggestion(s.key)}
                      className="accent-amber w-3.5 h-3.5 rounded cursor-pointer shrink-0"
                    />
                    <span className="text-[11px] text-cream/55 group-hover:text-cream/75 transition-colors leading-tight">
                      {t(strings.addRelative[s.labelType], {
                        name: s.existingMemberName,
                      })}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[9px] text-cream/25 leading-snug">
                {strings.addRelative.uncheckHint}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button onClick={handleAdd} size="sm" disabled={!name.trim()}>
              <UserPlus size={14} />{' '}
              {t(strings.addRelative.add, {
                type:
                  relativeTypes.find((r) => r.type === activeType)?.label ?? '',
              })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveType(null);
                setName('');
                setGender('unknown');
              }}
            >
              {strings.addRelative.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
