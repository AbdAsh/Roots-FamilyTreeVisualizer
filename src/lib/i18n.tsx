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
    searchPlaceholder: string;
    clearSearch: string;
    noMembers: string;
    firstPersonPrompt: string;
    language: string;
    toggleTheme: string;
  };
  // Passphrase screen
  auth: {
    plantTree: string;
    unlockTree: string;
    conceptLine: string;
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
    parent: string;
    child: string;
    spouseLabel: string;
    sibling: string;
    name: string;
    additionalRels: string;
    specialCaseHint: string;
    alsoChildOf: string; // "{name}"
    alsoParentOf: string; // "{name}"
    alsoSiblingOf: string; // "{name}"
    spouseOf: string; // "{name}"
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
    openSource: string;
    openSourceDesc: string;
    developer: string;
    developerRole: string;
    viewWebsite: string;
    viewGithub: string;
    viewLinkedin: string;
    // Plain-language content sections (A5)
    whatTitle: string;
    whatBody: string;
    linkTitle: string;
    linkBody: string;
    cryptoTitle: string;
    cryptoBody: string;
    shareTitle: string;
    shareBody: string;
    exportTitle: string;
    exportBody: string;
    langTitle: string;
    langBody: string;
    sizeNote: string;
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
  };
  // Walkthrough hints (HintBar)
  hints: {
    addRelatives: string;
    share: string;
  };
}

/* ─── English ─── */
const en: Translations = {
  app: {
    title: 'Roots',
    memberCount: '{count} member||{count} members',
    share: 'Share',
    lock: 'Lock',
    searchPlaceholder: 'Search members…',
    clearSearch: 'Clear search',
    noMembers: 'No family members yet',
    firstPersonPrompt: 'Add the first person — usually you',
    language: 'Language',
    toggleTheme: 'Toggle theme',
  },
  auth: {
    plantTree: 'Plant your family tree',
    unlockTree: 'Unlock a shared family tree',
    conceptLine:
      'Your whole family tree lives inside its own link, locked by a passphrase. No accounts, no servers.',
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
    parent: 'Parent',
    child: 'Child',
    spouseLabel: 'Spouse',
    sibling: 'Sibling',
    name: 'Name',
    additionalRels: 'Additional links',
    specialCaseHint:
      "Linked automatically. Uncheck any that don't apply — for example, a half-sibling with a different parent, or a step-parent.",
    alsoChildOf: 'Also a child of {name}',
    alsoParentOf: 'Also parent of {name}',
    alsoSiblingOf: 'Also sibling of {name}',
    spouseOf: 'Spouse of {name}',
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
    openSource: 'Open Source',
    openSourceDesc:
      'Roots is open source under the Apache 2.0 license. Contributions are welcome!',
    developer: 'Abdulrahman Mahmutoglu',
    developerRole: 'Senior Frontend Engineer',
    viewWebsite: 'Website',
    viewGithub: 'GitHub',
    viewLinkedin: 'LinkedIn',
    whatTitle: 'What is Roots?',
    whatBody: 'A private family-tree maker that runs entirely in your browser.',
    linkTitle: 'The link is the database',
    linkBody:
      "Your tree is compressed and packed into the page link itself — there's no server storing it.",
    cryptoTitle: 'Encrypted with your passphrase',
    cryptoBody:
      'The link is encrypted with AES-256-GCM. Your passphrase never leaves your browser; without it the link is unreadable.',
    shareTitle: 'Sharing',
    shareBody:
      'Send someone the link and the passphrase and they can view or edit the tree. Changes live only in their copy of the link.',
    exportTitle: 'Export & import',
    exportBody: 'Save your tree as JSON, PNG, or SVG, and import JSON back.',
    langTitle: 'Languages',
    langBody: 'English, Arabic (right-to-left), and Turkish.',
    sizeNote:
      'Because the whole tree fits in a link, very large trees may hit a size limit.',
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
  },
  hints: {
    addRelatives:
      'Tap a person, then use + to add parents, a partner, children, or siblings.',
    share:
      'Share copies a link — anyone with it and the passphrase can view and edit.',
  },
};

/* ─── Arabic ─── */
const ar: Translations = {
  app: {
    title: 'جذور',
    memberCount: '{count} عضو||{count} أعضاء',
    share: 'مشاركة',
    lock: 'قفل',
    searchPlaceholder: 'البحث عن الأعضاء…',
    clearSearch: 'مسح البحث',
    noMembers: 'لا يوجد أفراد في العائلة بعد',
    firstPersonPrompt: 'أضف أول شخص — غالباً أنت',
    language: 'اللغة',
    toggleTheme: 'تبديل السمة',
  },
  auth: {
    plantTree: 'ازرع شجرة عائلتك',
    unlockTree: 'افتح شجرة عائلة مشتركة',
    conceptLine:
      'شجرة عائلتك بأكملها موجودة داخل رابطها الخاص، محمية بعبارة مرور. بلا حسابات، بلا خوادم.',
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
    parent: 'والد/ة',
    child: 'ابن/ة',
    spouseLabel: 'زوج/ة',
    sibling: 'شقيق/ة',
    name: 'الاسم',
    additionalRels: 'روابط إضافية',
    specialCaseHint:
      'تُربط تلقائياً. ألغِ تحديد ما لا ينطبق — مثلاً أخ غير شقيق من والد مختلف، أو زوج/ة أحد الوالدين.',
    alsoChildOf: 'أيضاً ابن/ة لـ {name}',
    alsoParentOf: 'أيضاً والد/ة لـ {name}',
    alsoSiblingOf: 'أيضاً شقيق/ة لـ {name}',
    spouseOf: 'زوج/ة {name}',
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
    openSource: 'مفتوح المصدر',
    openSourceDesc:
      'جذور مفتوح المصدر بموجب رخصة Apache 2.0. المساهمات مرحب بها!',
    developer: 'عبدالرحمن محمد أوغلو',
    developerRole: 'مهندس واجهات أمامية أول',
    viewWebsite: 'الموقع',
    viewGithub: 'GitHub',
    viewLinkedin: 'LinkedIn',
    whatTitle: 'ما هو جذور؟',
    whatBody: 'أداة خاصة لإنشاء شجرة العائلة تعمل بالكامل داخل متصفحك.',
    linkTitle: 'الرابط هو قاعدة البيانات',
    linkBody:
      'يتم ضغط شجرتك وتعبئتها داخل رابط الصفحة نفسه — لا يوجد خادم يخزّنها.',
    cryptoTitle: 'مشفّرة بعبارة مرورك',
    cryptoBody:
      'الرابط مشفّر بخوارزمية AES-256-GCM. عبارة مرورك لا تغادر متصفحك أبدًا؛ وبدونها يظل الرابط غير قابل للقراءة.',
    shareTitle: 'المشاركة',
    shareBody:
      'أرسل الرابط وعبارة المرور إلى شخص ما وسيتمكن من عرض الشجرة أو تعديلها. التغييرات تبقى في نسخته الخاصة من الرابط.',
    exportTitle: 'التصدير والاستيراد',
    exportBody:
      'احفظ شجرتك بصيغة JSON أو PNG أو SVG، واستورد ملفات JSON مجددًا.',
    langTitle: 'اللغات',
    langBody: 'الإنجليزية، والعربية (من اليمين إلى اليسار)، والتركية.',
    sizeNote:
      'نظرًا لأن الشجرة بأكملها تُخزَّن في رابط، فقد تصل الأشجار الكبيرة جدًا إلى حد الحجم المسموح به.',
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
  },
  hints: {
    addRelatives:
      'اضغط على شخص، ثم استخدم + لإضافة والدين أو شريك أو أبناء أو أشقاء.',
    share:
      'المشاركة تنسخ رابطاً — يستطيع أي شخص يمتلكه مع عبارة المرور العرض والتعديل.',
  },
};

/* ─── Turkish ─── */
const tr: Translations = {
  app: {
    title: 'Kökler',
    memberCount: '{count} üye||{count} üye',
    share: 'Paylaş',
    lock: 'Kilitle',
    searchPlaceholder: 'Üye ara…',
    clearSearch: 'Aramayı temizle',
    noMembers: 'Henüz aile üyesi yok',
    firstPersonPrompt: 'İlk kişiyi ekleyin — genellikle siz',
    language: 'Dil',
    toggleTheme: 'Temayı değiştir',
  },
  auth: {
    plantTree: 'Aile ağacınızı oluşturun',
    unlockTree: 'Paylaşılan bir aile ağacını açın',
    conceptLine:
      'Tüm aile ağacın kendi bağlantısının içinde yaşar, bir parolayla kilitlenir. Hesap yok, sunucu yok.',
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
    parent: 'Ebeveyn',
    child: 'Çocuk',
    spouseLabel: 'Eş',
    sibling: 'Kardeş',
    name: 'Ad',
    additionalRels: 'Ek bağlantılar',
    specialCaseHint:
      'Otomatik olarak bağlanır. Geçerli olmayanların işaretini kaldırın — örneğin farklı bir ebeveyni olan üvey kardeş ya da üvey anne/baba.',
    alsoChildOf: 'Ayrıca {name} çocuğu',
    alsoParentOf: 'Ayrıca {name} ebeveyni',
    alsoSiblingOf: 'Ayrıca {name} kardeşi',
    spouseOf: '{name} eşi',
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
    openSource: 'Açık Kaynak',
    openSourceDesc:
      'Kökler, Apache 2.0 lisansı altında açık kaynaklıdır. Katkılar memnuniyetle karşılanır!',
    developer: 'Abdulrahman Mahmutoğlu',
    developerRole: 'Kıdemli Frontend Mühendisi',
    viewWebsite: 'Web Sitesi',
    viewGithub: 'GitHub',
    viewLinkedin: 'LinkedIn',
    whatTitle: 'Kökler Nedir?',
    whatBody:
      'Tamamen tarayıcınızda çalışan, gizli bir aile ağacı oluşturma aracı.',
    linkTitle: 'Bağlantı veritabanıdır',
    linkBody:
      'Ağacınız sıkıştırılarak sayfa bağlantısının içine paketlenir — onu depolayan herhangi bir sunucu yoktur.',
    cryptoTitle: 'Parolanızla şifreli',
    cryptoBody:
      'Bağlantı AES-256-GCM ile şifrelenir. Parolanız tarayıcınızı asla terk etmez; parolasız bağlantı okunamaz.',
    shareTitle: 'Paylaşım',
    shareBody:
      'Birine bağlantıyı ve parolayı gönderin; ağacı görüntüleyebilir veya düzenleyebilir. Değişiklikler yalnızca onların bağlantı kopyasında yaşar.',
    exportTitle: 'Dışa ve içe aktarma',
    exportBody:
      'Ağacınızı JSON, PNG veya SVG olarak kaydedin ve JSON dosyalarını geri içe aktarın.',
    langTitle: 'Diller',
    langBody: 'İngilizce, Arapça (sağdan sola) ve Türkçe.',
    sizeNote:
      'Tüm ağaç bir bağlantıya sığdığından, çok büyük ağaçlar boyut sınırına ulaşabilir.',
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
  },
  hints: {
    addRelatives:
      'Bir kişiye dokunun, ardından ebeveyn, partner, çocuk veya kardeş eklemek için + kullanın.',
    share:
      'Paylaş bir bağlantı kopyalar — bağlantıya ve parolaya sahip herkes görüntüleyip düzenleyebilir.',
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
