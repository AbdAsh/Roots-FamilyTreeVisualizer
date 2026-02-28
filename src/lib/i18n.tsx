/**
 * Internationalisation (i18n) system for Roots.
 *
 * Supports three locales: English (`en`), Arabic (`ar`, RTL), and Turkish (`tr`).
 * All UI strings are strongly typed via the {@link Translations} interface —
 * TypeScript enforces that every locale provides every key at compile time.
 *
 * **Usage:**
 * - Wrap the app in `<I18nProvider>` (done in `main.tsx`)
 * - Access strings via `useI18n()` → `strings.section.key`
 * - Interpolation: `t(strings.auth.throttled, { seconds: '5' })` for `"{seconds}"` placeholders
 * - Plurals: `tPlural(strings.app.memberCount, count)` — templates use `||` separator:
 *   `"{count} member||{count} members"` (singular before `||`, plural after)
 *
 * @module i18n
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

/* ─── Supported locales ─── */
export type Locale = 'en' | 'ar' | 'tr';

export const LOCALE_META: Record<
  Locale,
  { label: string; dir: 'ltr' | 'rtl'; flag: string }
> = {
  en: { label: 'English', dir: 'ltr', flag: '🇬🇧' },
  ar: { label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  tr: { label: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
};

/* ─── Translation keys ─── */
// All leaf-string keys used across the app.
// Nested structure: section -> key -> string
/**
 * All leaf-string keys used across the app.
 * Nested structure: `section.key` → translated string.
 *
 * **Adding new strings:** Add the key to this interface first, then add
 * the translation to all three locale objects (`en`, `ar`, `tr`).
 * TypeScript strict mode will error on any missing keys.
 *
 * **Placeholders:** Use `{key}` syntax, e.g. `"Hello {name}"`. Interpolated at runtime by {@link t}.
 * **Plurals:** Use `||` separator, e.g. `"{count} member||{count} members"`. Handled by {@link tPlural}.
 */
export interface Translations {
  // App chrome
  app: {
    title: string;
    memberCount: string; // "{count} member" / "{count} members"
    share: string;
    lock: string;
    search: string;
    searchPlaceholder: string;
    noMembers: string;
    hintAddRelative: string;
    language: string;
  };
  // Passphrase screen
  auth: {
    plantTree: string;
    unlockTree: string;
    familyName: string;
    familyNamePlaceholder: string;
    passphrase: string;
    choosePassphrase: string;
    enterPassphrase: string;
    passphraseHint: string;
    passphraseTooShort: string;
    passphraseTooWeak: string;
    strengthWeak: string;
    strengthFair: string;
    strengthGood: string;
    strengthStrong: string;
    throttled: string; // "{seconds}"
    resetButton: string;
    resetTitle: string;
    resetDisclaimer: string;
    resetConfirm: string;
    createTree: string;
    unlock: string;
    footer: string;
  };
  // Editor panel
  editor: {
    editMember: string;
    fullName: string;
    gender: string;
    male: string;
    female: string;
    other: string;
    unknown: string;
    birthDate: string;
    deathDate: string;
    photoUrl: string;
    location: string;
    occupation: string;
    bio: string;
    bioPlaceholder: string;
    customFields: string;
    addField: string;
    relationships: string;
    parents: string;
    children: string;
    spouse: string;
    siblings: string;
    noRelationships: string;
    remove: string;
    removeConfirmTitle: string;
    removeConfirmMessage: string; // "{name}"
    removeRelConfirmTitle: string;
    removeRelConfirmMessage: string; // "{from}" / "{to}"
  };
  // Add relative panel
  addRelative: {
    title: string;
    parent: string;
    child: string;
    spouseLabel: string;
    sibling: string;
    addParentOf: string; // "{name}"
    addChildOf: string;
    addSpouseOf: string;
    addSiblingOf: string;
    name: string;
    additionalRels: string;
    alsoChildOf: string; // "{name}"
    alsoParentOf: string; // "{name}"
    alsoSiblingOf: string; // "{name}"
    spouseOf: string; // "{name}"
    uncheckHint: string;
    add: string; // "Add {type}"
    cancel: string;
  };
  // Confirm modal
  confirm: {
    confirm: string;
    cancel: string;
  };
  // Share modal
  shareModal: {
    title: string;
    shareableLink: string;
    copy: string;
    copied: string;
    capacityUsed: string;
    capacityWarning: string;
    shareInstructions: string;
    shareInstructionsDetail: string;
  };
  // About modal
  about: {
    title: string;
    whatIsRoots: string;
    whatIsRootsDesc: string;
    howItWorks: string;
    howItWorksDesc: string;
    pipeline: string;
    layoutAlgorithm: string;
    layoutAlgorithmDesc: string;
    encryption: string;
    encryptionDesc: string;
    compression: string;
    compressionDesc: string;
    privacy: string;
    privacyDesc: string;
    techStack: string;
    openSource: string;
    openSourceDesc: string;
    developer: string;
    developerRole: string;
    viewWebsite: string;
    viewGithub: string;
    viewLinkedin: string;
  };
  // Legend
  legend: {
    title: string;
    parentChild: string;
    spouseRel: string;
    siblingRel: string;
  };
  // Export / Import
  exportImport: {
    exportJson: string;
    importJson: string;
    exportPng: string;
    exportSvg: string;
    importConfirmTitle: string;
    importConfirmMessage: string;
  };
  // Undo / Redo
  history: {
    undo: string;
    redo: string;
  };
  // Save status
  save: {
    saving: string;
    saved: string;
    error: string;
    capacity: string;
  };
  // Keyboard shortcuts
  shortcuts: {
    title: string;
    escape: string;
    deleteKey: string;
    undo: string;
    redo: string;
    search: string;
  };
}

/* ─── English ─── */
const en: Translations = {
  app: {
    title: 'Roots',
    memberCount: '{count} member||{count} members',
    share: 'Share',
    lock: 'Lock',
    search: 'Search',
    searchPlaceholder: 'Search members…',
    noMembers: 'No family members yet',
    hintAddRelative:
      'Click ＋ on a node to add relatives, or click the node to edit',
    language: 'Language',
  },
  auth: {
    plantTree: 'Plant your family tree',
    unlockTree: 'Unlock a shared family tree',
    familyName: 'Family Name',
    familyNamePlaceholder: 'The Smith Family',
    passphrase: 'Passphrase',
    choosePassphrase: 'Choose a passphrase',
    enterPassphrase: 'Enter passphrase',
    passphraseHint:
      'This passphrase encrypts your family tree. Share it with family members along with the link — there is no way to recover it if lost.',
    passphraseTooShort: 'Passphrase must be at least 8 characters',
    passphraseTooWeak:
      'Add uppercase, digits, or symbols for a stronger passphrase',
    strengthWeak: 'Weak',
    strengthFair: 'Fair',
    strengthGood: 'Good',
    strengthStrong: 'Strong',
    throttled: 'Too many attempts — wait {seconds}s',
    resetButton: 'Start a new tree',
    resetTitle: 'Start a new tree?',
    resetDisclaimer:
      'Proceeding will permanently clear the current encrypted tree from this URL. This action cannot be undone.\n\nMake sure you have either:\n• Saved the share link (the URL), or\n• Exported the tree to JSON\n\nbefore continuing.',
    resetConfirm: 'Clear & start new',
    createTree: 'Create Family Tree',
    unlock: 'Unlock',
    footer: 'Encrypted · No Account Required',
  },
  editor: {
    editMember: 'Edit Member',
    fullName: 'Full Name',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    unknown: 'Unknown',
    birthDate: 'Birth Date',
    deathDate: 'Death Date',
    photoUrl: 'Photo URL',
    location: 'Location',
    occupation: 'Occupation',
    bio: 'Bio',
    bioPlaceholder: 'A short biography…',
    customFields: 'Custom Fields',
    addField: 'Add',
    relationships: 'Relationships',
    parents: 'Parents',
    children: 'Children',
    spouse: 'Spouse',
    siblings: 'Siblings',
    noRelationships: 'No relationships yet',
    remove: 'Remove {name}',
    removeConfirmTitle: 'Remove Member',
    removeConfirmMessage:
      'Remove {name} and all their relationships? This cannot be undone.',
    removeRelConfirmTitle: 'Remove Relationship',
    removeRelConfirmMessage:
      'Remove the {type} relationship between {from} and {to}?',
  },
  addRelative: {
    title: 'Add Relative',
    parent: 'Parent',
    child: 'Child',
    spouseLabel: 'Spouse',
    sibling: 'Sibling',
    addParentOf: 'Add a parent of {name}',
    addChildOf: 'Add a child of {name}',
    addSpouseOf: 'Add a spouse of {name}',
    addSiblingOf: 'Add a sibling of {name}',
    name: 'Name',
    additionalRels: 'Additional relationships',
    alsoChildOf: 'Also a child of {name}',
    alsoParentOf: 'Also parent of {name}',
    alsoSiblingOf: 'Also sibling of {name}',
    spouseOf: 'Spouse of {name}',
    uncheckHint:
      'Uncheck for cases like half-siblings, adoption, or step-parents',
    add: 'Add {type}',
    cancel: 'Cancel',
  },
  confirm: {
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
  shareModal: {
    title: 'Share Family Tree',
    shareableLink: 'Shareable Link',
    copy: 'Copy',
    copied: 'Copied!',
    capacityUsed: 'URL capacity used',
    capacityWarning:
      'The URL is getting large. Consider shortening bios or reducing custom fields to keep the link shareable.',
    shareInstructions:
      'Share this link along with the passphrase to give your family access.',
    shareInstructionsDetail:
      'The data is encrypted — no one can view it without the passphrase, not even us. There are no accounts or servers involved.',
  },
  about: {
    title: 'About Roots',
    whatIsRoots: 'What is Roots?',
    whatIsRootsDesc:
      'Roots is a zero-backend family tree visualizer. Your entire family tree is encrypted and stored in the URL — no servers, no databases, no accounts. Share a link and a passphrase, and your family can view and edit the tree.',
    howItWorks: 'How It Works',
    howItWorksDesc:
      'The family tree data flows through a pipeline entirely in your browser:',
    pipeline:
      'JSON → Brotli Compress → AES-256-GCM Encrypt → Base64url → URL Hash',
    layoutAlgorithm: 'Layout Algorithm',
    layoutAlgorithmDesc:
      'The tree visualization uses the Buchheim-Reingold-Tilford algorithm — an O(n) layout that guarantees parents are centred over their children, subtrees never overlap, and identical subtrees are drawn identically. Spouse pairs are merged into couple containers.',
    encryption: 'Encryption',
    encryptionDesc:
      'AES-256-GCM via the Web Crypto API. Keys are derived with PBKDF2 (600,000 iterations). Each save generates a fresh random salt (16 bytes) and IV (12 bytes). The passphrase never leaves memory.',
    compression: 'Compression',
    compressionDesc:
      "Brotli compression (quality 11) via WebAssembly — runs before encryption because encrypted bytes have maximum entropy and don't compress. This maximises space savings within the ~8 KB URL limit.",
    privacy: 'Privacy',
    privacyDesc:
      'No server. No cookies. No tracking. No analytics. Your data never leaves the browser. The passphrase is held in memory only and cleared when you lock the tree.',
    techStack: 'Tech Stack',
    openSource: 'Open Source',
    openSourceDesc:
      'Roots is open source under the Apache 2.0 license. Contributions are welcome!',
    developer: 'Abdulrahman Mahmutoglu',
    developerRole: 'Senior Frontend Engineer',
    viewWebsite: 'Website',
    viewGithub: 'GitHub',
    viewLinkedin: 'LinkedIn',
  },
  legend: {
    title: 'Legend',
    parentChild: 'Parent → Child',
    spouseRel: 'Spouse',
    siblingRel: 'Sibling',
  },
  exportImport: {
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    exportPng: 'Export PNG',
    exportSvg: 'Export SVG',
    importConfirmTitle: 'Import Family Tree',
    importConfirmMessage: 'This will replace your current tree. Are you sure?',
  },
  history: {
    undo: 'Undo',
    redo: 'Redo',
  },
  save: {
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed',
    capacity: '{percent}%',
  },
  shortcuts: {
    title: 'Keyboard Shortcuts',
    escape: 'Close panel',
    deleteKey: 'Delete selected member',
    undo: 'Undo',
    redo: 'Redo',
    search: 'Focus search',
  },
};

/* ─── Arabic ─── */
const ar: Translations = {
  app: {
    title: 'جذور',
    memberCount: '{count} عضو||{count} أعضاء',
    share: 'مشاركة',
    lock: 'قفل',
    search: 'بحث',
    searchPlaceholder: 'البحث عن الأعضاء…',
    noMembers: 'لا يوجد أفراد في العائلة بعد',
    hintAddRelative:
      'انقر على ＋ بجانب العقدة لإضافة أقارب، أو انقر على العقدة للتعديل',
    language: 'اللغة',
  },
  auth: {
    plantTree: 'ازرع شجرة عائلتك',
    unlockTree: 'افتح شجرة عائلة مشتركة',
    familyName: 'اسم العائلة',
    familyNamePlaceholder: 'عائلة الأحمد',
    passphrase: 'كلمة المرور',
    choosePassphrase: 'اختر كلمة مرور',
    enterPassphrase: 'أدخل كلمة المرور',
    passphraseHint:
      'كلمة المرور هذه تُشفّر شجرة عائلتك. شاركها مع أفراد العائلة مع الرابط — لا توجد طريقة لاستعادتها إذا فُقدت.',
    passphraseTooShort: 'يجب أن تكون كلمة المرور ٨ أحرف على الأقل',
    passphraseTooWeak:
      'أضف أحرفًا كبيرة أو أرقامًا أو رموزًا لتعزيز قوة كلمة المرور',
    strengthWeak: 'ضعيفة',
    strengthFair: 'مقبولة',
    strengthGood: 'جيدة',
    strengthStrong: 'قوية',
    throttled: 'محاولات كثيرة — انتظر {seconds} ثانية',
    resetButton: 'بدء شجرة جديدة',
    resetTitle: 'هل تريد بدء شجرة جديدة؟',
    resetDisclaimer:
      'سيؤدي هذا إلى حذف شجرة العائلة المشفّرة من هذا الرابط بشكل دائم. لا يمكن التراجع عن هذا الإجراء.\n\nتأكد من حفظ رابط المشاركة (العنوان) أو تصدير الشجرة بصيغة JSON قبل المتابعة.',
    resetConfirm: 'مسح وبدء جديد',
    createTree: 'إنشاء شجرة العائلة',
    unlock: 'فتح',
    footer: 'مُشفّر · بدون حساب',
  },
  editor: {
    editMember: 'تعديل العضو',
    fullName: 'الاسم الكامل',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    other: 'آخر',
    unknown: 'غير محدد',
    birthDate: 'تاريخ الميلاد',
    deathDate: 'تاريخ الوفاة',
    photoUrl: 'رابط الصورة',
    location: 'الموقع',
    occupation: 'المهنة',
    bio: 'نبذة',
    bioPlaceholder: 'نبذة مختصرة…',
    customFields: 'حقول مخصصة',
    addField: 'إضافة',
    relationships: 'العلاقات',
    parents: 'الآباء',
    children: 'الأبناء',
    spouse: 'الزوج/ة',
    siblings: 'الأشقاء',
    noRelationships: 'لا توجد علاقات بعد',
    remove: 'حذف {name}',
    removeConfirmTitle: 'حذف العضو',
    removeConfirmMessage: 'حذف {name} وجميع علاقاته؟ لا يمكن التراجع عن هذا.',
    removeRelConfirmTitle: 'حذف العلاقة',
    removeRelConfirmMessage: 'حذف علاقة {type} بين {from} و {to}؟',
  },
  addRelative: {
    title: 'إضافة قريب',
    parent: 'والد/ة',
    child: 'ابن/ة',
    spouseLabel: 'زوج/ة',
    sibling: 'شقيق/ة',
    addParentOf: 'إضافة والد/ة لـ {name}',
    addChildOf: 'إضافة ابن/ة لـ {name}',
    addSpouseOf: 'إضافة زوج/ة لـ {name}',
    addSiblingOf: 'إضافة شقيق/ة لـ {name}',
    name: 'الاسم',
    additionalRels: 'علاقات إضافية',
    alsoChildOf: 'أيضاً ابن/ة لـ {name}',
    alsoParentOf: 'أيضاً والد/ة لـ {name}',
    alsoSiblingOf: 'أيضاً شقيق/ة لـ {name}',
    spouseOf: 'زوج/ة {name}',
    uncheckHint:
      'ألغِ التحديد في حالات مثل الأشقاء من أب/أم فقط أو التبني أو زوج/ة الأب/الأم',
    add: 'إضافة {type}',
    cancel: 'إلغاء',
  },
  confirm: {
    confirm: 'تأكيد',
    cancel: 'إلغاء',
  },
  shareModal: {
    title: 'مشاركة شجرة العائلة',
    shareableLink: 'رابط المشاركة',
    copy: 'نسخ',
    copied: 'تم النسخ!',
    capacityUsed: 'السعة المستخدمة في الرابط',
    capacityWarning:
      'الرابط أصبح كبيراً. حاول تقصير السير الذاتية أو تقليل الحقول المخصصة للحفاظ على إمكانية المشاركة.',
    shareInstructions: 'شارك هذا الرابط مع كلمة المرور لمنح عائلتك حق الوصول.',
    shareInstructionsDetail:
      'البيانات مُشفّرة — لا يمكن لأحد عرضها بدون كلمة المرور، ولا حتى نحن. لا توجد حسابات أو خوادم.',
  },
  about: {
    title: 'حول جذور',
    whatIsRoots: 'ما هو جذور؟',
    whatIsRootsDesc:
      'جذور هو تطبيق لعرض شجرة العائلة بدون خوادم. يتم تشفير شجرة عائلتك بالكامل وتخزينها في الرابط — بدون خوادم، بدون قواعد بيانات، بدون حسابات. شارك الرابط وكلمة المرور، وسيتمكن أفراد عائلتك من عرض الشجرة وتعديلها.',
    howItWorks: 'كيف يعمل',
    howItWorksDesc: 'تمر بيانات شجرة العائلة عبر خط أنابيب بالكامل في متصفحك:',
    pipeline: 'JSON → ضغط Brotli → تشفير AES-256-GCM → Base64url → رابط URL',
    layoutAlgorithm: 'خوارزمية التخطيط',
    layoutAlgorithmDesc:
      'يستخدم عرض الشجرة خوارزمية Buchheim-Reingold-Tilford — تخطيط بتعقيد O(n) يضمن أن الآباء في المنتصف فوق أبنائهم، والأشجار الفرعية لا تتداخل أبداً، والأشجار الفرعية المتماثلة تُرسم بشكل متماثل.',
    encryption: 'التشفير',
    encryptionDesc:
      'AES-256-GCM عبر Web Crypto API. يتم اشتقاق المفاتيح باستخدام PBKDF2 (٦٠٠,٠٠٠ تكرار). كل حفظ يولّد ملح عشوائي جديد (١٦ بايت) و IV (١٢ بايت). كلمة المرور لا تغادر الذاكرة أبداً.',
    compression: 'الضغط',
    compressionDesc:
      'ضغط Brotli (جودة ١١) عبر WebAssembly — يتم قبل التشفير لأن البايتات المشفرة لا تنضغط. هذا يزيد توفير المساحة ضمن حد الرابط ~٨ كيلوبايت.',
    privacy: 'الخصوصية',
    privacyDesc:
      'لا خوادم. لا ملفات تعريف ارتباط. لا تتبع. لا تحليلات. بياناتك لا تغادر المتصفح أبداً. كلمة المرور محفوظة في الذاكرة فقط وتُمسح عند قفل الشجرة.',
    techStack: 'التقنيات المستخدمة',
    openSource: 'مفتوح المصدر',
    openSourceDesc:
      'جذور مفتوح المصدر بموجب رخصة Apache 2.0. المساهمات مرحب بها!',
    developer: 'عبدالرحمن محمد أوغلو',
    developerRole: 'مهندس واجهات أمامية أول',
    viewWebsite: 'الموقع',
    viewGithub: 'GitHub',
    viewLinkedin: 'LinkedIn',
  },
  legend: {
    title: 'دليل الرموز',
    parentChild: 'والد ← ابن',
    spouseRel: 'زوج/ة',
    siblingRel: 'شقيق/ة',
  },
  exportImport: {
    exportJson: 'تصدير JSON',
    importJson: 'استيراد JSON',
    exportPng: 'تصدير PNG',
    exportSvg: 'تصدير SVG',
    importConfirmTitle: 'استيراد شجرة العائلة',
    importConfirmMessage: 'سيؤدي هذا إلى استبدال شجرتك الحالية. هل أنت متأكد؟',
  },
  history: {
    undo: 'تراجع',
    redo: 'إعادة',
  },
  save: {
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ',
    error: 'فشل الحفظ',
    capacity: '{percent}%',
  },
  shortcuts: {
    title: 'اختصارات لوحة المفاتيح',
    escape: 'إغلاق اللوحة',
    deleteKey: 'حذف العضو المحدد',
    undo: 'تراجع',
    redo: 'إعادة',
    search: 'البحث',
  },
};

/* ─── Turkish ─── */
const tr: Translations = {
  app: {
    title: 'Kökler',
    memberCount: '{count} üye||{count} üye',
    share: 'Paylaş',
    lock: 'Kilitle',
    search: 'Ara',
    searchPlaceholder: 'Üye ara…',
    noMembers: 'Henüz aile üyesi yok',
    hintAddRelative:
      'Akraba eklemek için düğümdeki ＋ işaretine, düzenlemek için düğüme tıklayın',
    language: 'Dil',
  },
  auth: {
    plantTree: 'Aile ağacınızı oluşturun',
    unlockTree: 'Paylaşılan bir aile ağacını açın',
    familyName: 'Aile Adı',
    familyNamePlaceholder: 'Yılmaz Ailesi',
    passphrase: 'Parola',
    choosePassphrase: 'Bir parola seçin',
    enterPassphrase: 'Parolayı girin',
    passphraseHint:
      'Bu parola aile ağacınızı şifreler. Aile üyelerinizle bağlantıyla birlikte paylaşın — kaybedildiğinde kurtarma yolu yoktur.',
    passphraseTooShort: 'Parola en az 8 karakter olmalıdır',
    passphraseTooWeak:
      'Daha güçlü bir parola için büyük harf, rakam veya sembol ekleyin',
    strengthWeak: 'Zayıf',
    strengthFair: 'Orta',
    strengthGood: 'İyi',
    strengthStrong: 'Güçlü',
    throttled: 'Çok fazla deneme — {seconds}s bekleyin',
    resetButton: 'Yeni ağaç başlat',
    resetTitle: 'Yeni ağaç başlatılsın mı?',
    resetDisclaimer:
      "Bu işlem mevcut şifreli aile ağacını bu URL'den kalıcı olarak silecektir. Bu işlem geri alınamaz.\n\nDevam etmeden önce:\n• Paylaşım bağlantısını (URL) kaydetmiş, ya da\n• Ağacı JSON olarak dışa aktarmış olduğunuzdan emin olun.",
    resetConfirm: 'Temizle ve yeni başlat',
    createTree: 'Aile Ağacı Oluştur',
    unlock: 'Aç',
    footer: 'Şifreli · Hesap Gerekmez',
  },
  editor: {
    editMember: 'Üye Düzenle',
    fullName: 'Ad Soyad',
    gender: 'Cinsiyet',
    male: 'Erkek',
    female: 'Kadın',
    other: 'Diğer',
    unknown: 'Bilinmiyor',
    birthDate: 'Doğum Tarihi',
    deathDate: 'Ölüm Tarihi',
    photoUrl: 'Fotoğraf URL',
    location: 'Konum',
    occupation: 'Meslek',
    bio: 'Biyografi',
    bioPlaceholder: 'Kısa bir biyografi…',
    customFields: 'Özel Alanlar',
    addField: 'Ekle',
    relationships: 'İlişkiler',
    parents: 'Anne/Baba',
    children: 'Çocuklar',
    spouse: 'Eş',
    siblings: 'Kardeşler',
    noRelationships: 'Henüz ilişki yok',
    remove: '{name} Sil',
    removeConfirmTitle: 'Üyeyi Sil',
    removeConfirmMessage:
      '{name} ve tüm ilişkileri silinecek. Bu geri alınamaz.',
    removeRelConfirmTitle: 'İlişkiyi Sil',
    removeRelConfirmMessage:
      '{from} ile {to} arasındaki {type} ilişkisi silinsin mi?',
  },
  addRelative: {
    title: 'Akraba Ekle',
    parent: 'Ebeveyn',
    child: 'Çocuk',
    spouseLabel: 'Eş',
    sibling: 'Kardeş',
    addParentOf: '{name} için ebeveyn ekle',
    addChildOf: '{name} için çocuk ekle',
    addSpouseOf: '{name} için eş ekle',
    addSiblingOf: '{name} için kardeş ekle',
    name: 'Ad',
    additionalRels: 'Ek ilişkiler',
    alsoChildOf: 'Ayrıca {name} çocuğu',
    alsoParentOf: 'Ayrıca {name} ebeveyni',
    alsoSiblingOf: 'Ayrıca {name} kardeşi',
    spouseOf: '{name} eşi',
    uncheckHint:
      'Üvey kardeş, evlat edinme veya üvey ebeveyn gibi durumlarda işareti kaldırın',
    add: '{type} Ekle',
    cancel: 'İptal',
  },
  confirm: {
    confirm: 'Onayla',
    cancel: 'İptal',
  },
  shareModal: {
    title: 'Aile Ağacını Paylaş',
    shareableLink: 'Paylaşılabilir Bağlantı',
    copy: 'Kopyala',
    copied: 'Kopyalandı!',
    capacityUsed: 'URL kapasitesi kullanımı',
    capacityWarning:
      'URL büyüklüğü artıyor. Bağlantının paylaşılabilir kalması için biyografileri kısaltın veya özel alanları azaltın.',
    shareInstructions:
      'Bu bağlantıyı parolayla birlikte paylaşarak ailenize erişim verin.',
    shareInstructionsDetail:
      'Veriler şifrelenir — parola olmadan kimse göremez, biz bile. Hesap veya sunucu yoktur.',
  },
  about: {
    title: 'Kökler Hakkında',
    whatIsRoots: 'Kökler Nedir?',
    whatIsRootsDesc:
      "Kökler, sunucusuz bir aile ağacı görselleştiricisidir. Aile ağacınızın tamamı şifrelenerek URL'de saklanır — sunucu yok, veritabanı yok, hesap yok. Bir bağlantı ve parola paylaşın, aileniz ağacı görüntüleyip düzenleyebilsin.",
    howItWorks: 'Nasıl Çalışır',
    howItWorksDesc:
      'Aile ağacı verileri tamamen tarayıcınızda bir işlem hattından geçer:',
    pipeline:
      'JSON → Brotli Sıkıştırma → AES-256-GCM Şifreleme → Base64url → URL Hash',
    layoutAlgorithm: 'Yerleşim Algoritması',
    layoutAlgorithmDesc:
      'Ağaç görselleştirmesi Buchheim-Reingold-Tilford algoritmasını kullanır — ebeveynlerin çocuklarının üzerinde ortalandığını, alt ağaçların hiç çakışmadığını ve özdeş alt ağaçların aynı şekilde çizildiğini garanti eden O(n) bir yerleşim.',
    encryption: 'Şifreleme',
    encryptionDesc:
      'Web Crypto API ile AES-256-GCM. Anahtarlar PBKDF2 (600.000 iterasyon) ile türetilir. Her kayıtta yeni rastgele tuz (16 bayt) ve IV (12 bayt) üretilir. Parola asla bellekten çıkmaz.',
    compression: 'Sıkıştırma',
    compressionDesc:
      'WebAssembly ile Brotli sıkıştırma (kalite 11) — şifreleme öncesi uygulanır çünkü şifreli baytlar sıkıştırılamaz. Bu, ~8 KB URL sınırı içinde maksimum alan tasarrufu sağlar.',
    privacy: 'Gizlilik',
    privacyDesc:
      'Sunucu yok. Çerez yok. Takip yok. Analitik yok. Verileriniz tarayıcıdan asla çıkmaz. Parola yalnızca bellekte tutulur ve ağaç kilitlendiğinde silinir.',
    techStack: 'Teknoloji Yığını',
    openSource: 'Açık Kaynak',
    openSourceDesc:
      'Kökler, Apache 2.0 lisansı altında açık kaynaklıdır. Katkılar memnuniyetle karşılanır!',
    developer: 'Abdulrahman Mahmutoğlu',
    developerRole: 'Kıdemli Frontend Mühendisi',
    viewWebsite: 'Web Sitesi',
    viewGithub: 'GitHub',
    viewLinkedin: 'LinkedIn',
  },
  legend: {
    title: 'Açıklama',
    parentChild: 'Ebeveyn → Çocuk',
    spouseRel: 'Eş',
    siblingRel: 'Kardeş',
  },
  exportImport: {
    exportJson: 'JSON Dışa Aktar',
    importJson: 'JSON İçe Aktar',
    exportPng: 'PNG Dışa Aktar',
    exportSvg: 'SVG Dışa Aktar',
    importConfirmTitle: 'Aile Ağacı İçe Aktar',
    importConfirmMessage:
      'Bu işlem mevcut ağacınızı değiştirecek. Emin misiniz?',
  },
  history: {
    undo: 'Geri Al',
    redo: 'Yinele',
  },
  save: {
    saving: 'Kaydediliyor…',
    saved: 'Kaydedildi',
    error: 'Kayıt başarısız',
    capacity: '%{percent}',
  },
  shortcuts: {
    title: 'Klavye Kısayolları',
    escape: 'Paneli kapat',
    deleteKey: 'Seçili üyeyi sil',
    undo: 'Geri al',
    redo: 'Yinele',
    search: 'Aramaya odaklan',
  },
};

/* ─── Registry ─── */
const translations: Record<Locale, Translations> = { en, ar, tr };

/* ─── Helper: interpolate {name} placeholders ─── */
export function t(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  );
}

/**
 * Pluralisation helper.
 * Template: "singular||plural"  e.g. "{count} member||{count} members"
 */
export function tPlural(
  template: string,
  count: number,
  vars?: Record<string, string | number>,
): string {
  const merged = { count, ...vars };
  const parts = template.split('||');
  const chosen = count === 1 ? parts[0] : (parts[1] ?? parts[0]);
  return t(chosen, merged);
}

/* ─── Context ─── */
interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  strings: Translations;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  strings: en,
  dir: 'ltr',
});

const STORAGE_KEY = 'roots-locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleRaw] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) return stored as Locale;
    // Auto-detect from browser
    const nav = navigator.language.slice(0, 2);
    if (nav === 'ar') return 'ar';
    if (nav === 'tr') return 'tr';
    return 'en';
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleRaw(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
    document.documentElement.dir = LOCALE_META[l].dir;
  }, []);

  // Set lang/dir on mount
  useMemo(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_META[locale].dir;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      strings: translations[locale],
      dir: LOCALE_META[locale].dir,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
