import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Avatar } from '@/components/ui/Avatar';
import { Plus, X } from 'lucide-react';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';
import type { FamilyMember, Gender } from '@/types/family';

interface MemberFormProps {
  member: FamilyMember;
}

export function MemberForm({ member }: MemberFormProps) {
  const updateMember = useTreeStore((s) => s.updateMember);
  const { strings } = useI18n();

  const genderOptions = [
    { value: 'male', label: strings.editor.male },
    { value: 'female', label: strings.editor.female },
    { value: 'other', label: strings.editor.other },
    { value: 'unknown', label: strings.editor.unknown },
  ];

  const [form, setForm] = useState({
    name: member.name,
    birthDate: member.birthDate ?? '',
    deathDate: member.deathDate ?? '',
    gender: member.gender as string,
    photoUrl: member.photoUrl ?? '',
    bio: member.bio ?? '',
    location: member.location ?? '',
    occupation: member.occupation ?? '',
    customFields: { ...member.customFields },
  });

  // Sync when member changes
  useEffect(() => {
    setForm({
      name: member.name,
      birthDate: member.birthDate ?? '',
      deathDate: member.deathDate ?? '',
      gender: member.gender,
      photoUrl: member.photoUrl ?? '',
      bio: member.bio ?? '',
      location: member.location ?? '',
      occupation: member.occupation ?? '',
      customFields: { ...member.customFields },
    });
  }, [member.id]);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));

    // Auto-save on each change
    const updates: Partial<FamilyMember> = {
      [field]: value || undefined,
    };
    if (field === 'name' && !value.trim()) return; // Don't save empty name
    if (field === 'gender') updates.gender = value as Gender;
    updateMember(member.id, updates);
  };

  const handleCustomFieldChange = (
    key: string,
    value: string,
    oldKey?: string,
  ) => {
    const newFields = { ...form.customFields };
    if (oldKey && oldKey !== key) {
      delete newFields[oldKey];
    }
    newFields[key] = value;
    setForm((f) => ({ ...f, customFields: newFields }));
    updateMember(member.id, { customFields: newFields });
  };

  const addCustomField = () => {
    const key = `Field ${Object.keys(form.customFields).length + 1}`;
    handleCustomFieldChange(key, '');
  };

  const removeCustomField = (key: string) => {
    const newFields = { ...form.customFields };
    delete newFields[key];
    setForm((f) => ({ ...f, customFields: newFields }));
    updateMember(member.id, { customFields: newFields });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar preview */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar
          name={form.name || 'N'}
          photoUrl={form.photoUrl || undefined}
          gender={form.gender as Gender}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base text-cream truncate">
            {form.name || 'Unnamed'}
          </p>
          {form.birthDate && (
            <p className="text-xs text-cream/40">
              b. {form.birthDate}
              {form.deathDate ? ` — d. ${form.deathDate}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Core fields */}
      <Input
        label={strings.editor.fullName}
        value={form.name}
        onChange={(e) => handleChange('name', e.target.value)}
        placeholder="First Last"
      />

      <Select
        label={strings.editor.gender}
        value={form.gender}
        onChange={(e) => handleChange('gender', e.target.value)}
        options={genderOptions}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={strings.editor.birthDate}
          type="date"
          value={form.birthDate}
          onChange={(e) => handleChange('birthDate', e.target.value)}
        />
        <Input
          label={strings.editor.deathDate}
          type="date"
          value={form.deathDate}
          onChange={(e) => handleChange('deathDate', e.target.value)}
        />
      </div>

      <Input
        label={strings.editor.photoUrl}
        value={form.photoUrl}
        onChange={(e) => handleChange('photoUrl', e.target.value)}
        placeholder="https://..."
      />

      <Input
        label={strings.editor.location}
        value={form.location}
        onChange={(e) => handleChange('location', e.target.value)}
        placeholder="City, Country"
      />

      <Input
        label={strings.editor.occupation}
        value={form.occupation}
        onChange={(e) => handleChange('occupation', e.target.value)}
        placeholder=""
      />

      <TextArea
        label={strings.editor.bio}
        value={form.bio}
        onChange={(e) => handleChange('bio', e.target.value)}
        placeholder={strings.editor.bioPlaceholder}
        rows={3}
      />

      {/* Custom Fields */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-cream/60 uppercase tracking-wider">
            {strings.editor.customFields}
          </span>
          <button
            onClick={addCustomField}
            className="text-xs text-amber/70 hover:text-amber flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus size={12} /> {strings.editor.addField}
          </button>
        </div>

        {Object.entries(form.customFields).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <Input
              value={key}
              onChange={(e) =>
                handleCustomFieldChange(e.target.value, value, key)
              }
              placeholder="Label"
              className="!text-xs flex-[0.4]"
            />
            <Input
              value={value}
              onChange={(e) => handleCustomFieldChange(key, e.target.value)}
              placeholder="Value"
              className="!text-xs flex-[0.6]"
            />
            <button
              onClick={() => removeCustomField(key)}
              className="mt-1.5 p-1.5 text-cream/30 hover:text-error transition-colors cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
