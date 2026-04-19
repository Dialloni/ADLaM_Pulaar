export type LanguageCode = 'ff-adlm' | 'fr' | 'en';

export interface UIStrings {
  /* auth */
  appName: string;
  loginWithGoogle: string;
  heroTitle: string;
  heroSubtitle: string;
  beta: string;
  errorAuth: string;

  /* nav */
  dashboardNav: string;
  projectsNav: string;
  assetsNav: string;
  searchPlaceholder: string;

  /* sidebar */
  myProjectsLabel: string;
  languageAssetsLabel: string;
  settingsNav: string;
  teamHubLabel: string;
  newProject: string;
  documentationLabel: string;
  systemStatusLabel: string;
  signOut: string;
  projectsCreatedLabel: string;

  /* profile dropdown */
  profile: string;
  viewProfile: string;

  /* dashboard */
  gandoViewTitle: string;
  gandoViewSubtitle: string;
  projectsLabel: string;
  appsBuiltLabel: string;
  generateLabel: string;
  activeSiteBuildsLabel: string;
  viewAllLabel: string;
  projectCompletionLabel: string;
  completionSubtitle: string;
  tokenUsageLabel: string;
  tokenResetHint: string;
  healthyLabel: string;
  appPerformanceLabel: string;
  excellentLabel: string;
  latencyLabel: string;
  uptimeLabel: string;
  runtimeLabel: string;
  totalFlowLabel: string;
  appsGeneratedLabel: string;
  totalPromptsLabel: string;
  noProjectsTitle: string;
  noProjectsSubtitle: string;

  /* projects page */
  projectsPageTitle: string;
  projectsPageSubtitle: string;
  searchProjectsPlaceholder: string;
  deleteProjectLabel: string;
  openProjectLabel: string;
  confirmDelete: string;
  recentProjects: string;

  /* workspace */
  preview: string;
  code: string;
  download: string;
  rename: string;
  deleteConfirm: string;
  revertLabel: string;
  currentVersionLabel: string;

  /* chat */
  chatWelcome: string;
  chatSubtitle: string;
  chatPlaceholder: string;
  aiDisclaimer: string;
  inputPlaceholder: string;
  generating: string;
  copy: string;
  copied: string;
  output: string;
  tips: string;
  ecommerce: string;
  ecommercePrompt: string;
  languageLearning: string;
  languageLearningPrompt: string;
  communityHub: string;
  communityHubPrompt: string;
  you: string;
  gandoAI: string;

  /* docs page */
  docsPageTitle: string;
  docsPageSubtitle: string;
  docsSection1Title: string;
  docsSection1Body: string;
  docsSection2Title: string;
  docsSection2Body: string;
  docsSection3Title: string;
  docsSection3Body: string;

  /* status page */
  statusPageTitle: string;
  statusPageSubtitle: string;
  statusServer: string;
  statusAI: string;
  statusFirebase: string;
  statusOperational: string;
  statusDegraded: string;
  statusDown: string;
  statusChecking: string;
  statusLastChecked: string;
  statusModel: string;

  /* misc */
  settings: string;
  logout: string;
  share: string;
  deploy: string;
  language: string;
  advanced: string;
  errorNetwork: string;
  errorGeneration: string;
  successGenerated: string;
  suggestionDashboard: string;
  suggestionDashboardPrompt: string;
  suggestionLearning: string;
  suggestionLearningPrompt: string;
  suggestionBusiness: string;
  suggestionBusinessPrompt: string;
}

export const TRANSLATIONS: Record<LanguageCode, UIStrings> = {

  /* ═══════════════════════════════════════
     FULANI — ADLaM SCRIPT
  ═══════════════════════════════════════ */
  'ff-adlm': {
    /* auth */
    appName: "𞤘𞤢𞤲𞤣𞤮",
    loginWithGoogle: "𞤔𞤮𞤳𞥆𞤵 𞤫 𞤘𞤵𞥅𞤺𞤮𞤤",
    heroTitle: "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆𞤧 𞤫 𞤘𞤢𞤲𞤣𞤮.",
    heroSubtitle: "𞤃𞤢𞤸𞤮𞥅𞤱𞤮 𞤢𞤨𞥆𞤧 𞤶𞤢𞤥𞤢𞥄𞤲𞤵 𞤲𞤺𞤢𞤥 𞤀𞤬𞤪𞤭𞤳𞤢. 𞤖𞤢𞥄𞤤𞤵 𞤳𞤮 𞤲𞤮𞤼𞥆𞤢𞥄 𞤯𞤫𞤲𞤯𞤢𞤤 𞤥𞤢𞥄𞤯𞤢.",
    beta: "𞤘𞤢𞤲𞤣𞤮 𞤄𞤫𞤼𞤢",
    errorAuth: "𞤊𞤭𞤣𞥆𞤭𞥅𞤲𞤣𞤫 𞤲𞤮 𞤱𞤢𞤲𞤢𞥄. 𞤐𞤮𞤱𞥆𞤮 𞤫 𞤔𞤮𞤳𞥆𞤵.",

    /* nav */
    dashboardNav: "𞤚𞤢𞤩𞤤𞤮",
    projectsNav: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    assetsNav: "𞤑𞤢𞥄𞤤𞤫𞥅𞤶𞤭",
    searchPlaceholder: "𞤕𞤫𞥅𞤰𞤭 𞤘𞤢𞤲𞤣𞤮...",

    /* sidebar */
    myProjectsLabel: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤢𞤥",
    languageAssetsLabel: "𞤆𞤓𞤂𞤀𞥄𞤈 𞤑𞤢𞥄𞤤𞤫𞥅𞤶𞤭",
    settingsNav: "𞤚𞤫𞤩𞥆𞤫",
    teamHubLabel: "𞤒𞤫𞤴𞥆𞤢𞤥",
    newProject: "𞤆𞤮𞤪𞤮𞤶𞤫 𞤳𞤫𞤧𞤮",
    documentationLabel: "𞤀𞤬𞤪𞤢𞤥𞤪𞤫",
    systemStatusLabel: "𞤅𞤭𞤧𞤼𞤫𞤥 𞤅𞤢𞤻𞤮𞤪𞤫",
    signOut: "𞤒𞤢𞤤𞤼𞤵𞤯𞤮",
    projectsCreatedLabel: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤐𞤢𞤥𞤥𞤭𞤯𞤭𞤯𞤢𞥄",

    /* profile */
    profile: "𞤆𞤪𞤮𞤬𞤭𞤤",
    viewProfile: "𞤖𞤮𞤤𞤼𞤭 𞤆𞤪𞤮𞤬𞤭𞤤",

    /* dashboard */
    gandoViewTitle: "𞤘𞤢𞤲𞤣𞤮 𞤖𞤢𞤤𞤭𞤲𞤣𞤫",
    gandoViewSubtitle: "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆𞥆𞤫 𞤫 𞤯𞤫𞤲𞤯𞤢𞤤 𞤥𞤢𞥄𞤯𞤢 𞤥𞤢𞤥",
    projectsLabel: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    appsBuiltLabel: "𞤀𞤨𞥆𞤧 𞤃𞤢𞤸𞤢𞥄𞤯𞤭",
    generateLabel: "𞤃𞤢𞤸𞤵",
    activeSiteBuildsLabel: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤑𞤭𞤸𞤯𞤵𞤯𞤭",
    viewAllLabel: "𞤖𞤮𞤤𞤼𞤭 𞤸𞤫𞤯𞤯𞤢𞤲",
    projectCompletionLabel: "𞤆𞤮𞤪𞤮𞤶𞤫 𞤏𞤢𞤼𞤵𞤣𞤫",
    completionSubtitle: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤢𞤥 𞤫 𞤘𞤢𞤲𞤣𞤮.",
    tokenUsageLabel: "𞤚𞤮𞤳𞤫𞤲 𞤁𞤢𞤩𞤦𞤮𞤪𞤣𞤫",
    tokenResetHint: "𞤚𞤮𞤳𞤫𞤲 𞤯𞤮𞥅𞤸𞤫𞥅𞤲 𞤯𞤵𞤥.",
    healthyLabel: "𞤌𞤲𞤣𞤢𞤥",
    appPerformanceLabel: "𞤃𞤢𞤸𞤮𞥅𞤱𞤮 𞤀𞤨𞥆",
    excellentLabel: "𞤇𞤫𞥅𞤯𞤢𞤲",
    latencyLabel: "𞤔𞤢𞥄𞤤𞤫𞤤",
    uptimeLabel: "𞤒𞤨𞤼𞤭𞤥",
    runtimeLabel: "𞤚𞤢𞤩𞤤𞤮",
    totalFlowLabel: "𞤸𞤫𞤯𞤯𞤢𞤲 𞤸𞤢𞤻𞤫𞥅𞤲𞤣𞤫",
    appsGeneratedLabel: "𞤀𞤨𞥆𞤧 𞤃𞤢𞤸𞤢𞥄𞤯𞤭",
    totalPromptsLabel: "𞤖𞤢𞥄𞤤𞤵 𞤸𞤫𞤯𞤯𞤢𞤲",
    noProjectsTitle: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤲𞤣𞤫𞥅",
    noProjectsSubtitle: "𞤖𞤢𞥄𞤤𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 𞤘𞤢𞤲𞤣𞤮 𞤫 𞤃𞤢𞤸𞤵.",

    /* projects page */
    projectsPageTitle: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤢𞤥",
    projectsPageSubtitle: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤣𞤮 𞤲𞤢𞤥𞤥𞤭𞤯𞤭",
    searchProjectsPlaceholder: "𞤕𞤫𞥅𞤰𞤭 𞤆𞤮𞤪𞤮𞤶𞤫...",
    deleteProjectLabel: "𞤊𞤵𞤦𞤢 𞤆𞤮𞤪𞤮𞤶𞤫",
    openProjectLabel: "𞤊𞤭𞤤𞤵 𞤆𞤮𞤪𞤮𞤶𞤫",
    confirmDelete: "𞤀𞤯𞤢 𞤤𞤢𞥄𞤩𞤭 𞤢 𞤲𞤮𞤼𞥆𞤭𞥅 𞤥𞤮𞤥𞤼𞤵𞤣𞤫 𞤯𞤵𞤥?",
    recentProjects: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤩𞤫𞤲𞥆𞤵𞤯𞤭",

    /* workspace */
    preview: "𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫",
    code: "𞤑𞤮𞥅𞤣",
    download: "𞤔𞤫𞤩𞥆𞤵",
    rename: "𞤏𞤢𞤼𞥆𞤵 𞤭𞤲𞤣𞤫",
    deleteConfirm: "𞤀𞤯𞤢 𞤤𞤢𞥄𞤩𞤭 𞤢 𞤲𞤮𞤼𞥆𞤭𞥅 𞤥𞤮𞤥𞤼𞤵𞤣𞤫 𞤯𞤵𞤥?",
    revertLabel: "𞤊𞤭𞤤𞤼𞤵",
    currentVersionLabel: "𞤕𞤫𞥅𞤰𞤭𞤯𞤭 𞤸𞤢𞤲𞤳𞤭𞤣𞤫",

    /* chat */
    chatWelcome: "𞤑𞤮 𞤸𞤮𞤲𞤯𞤵𞤥 𞤥𞤢𞤸𞤮𞤼𞤢𞥄 𞤸𞤢𞤲𞤣𞤫?",
    chatSubtitle: "𞤖𞤢𞥄𞤤𞤵 𞤳𞤮 𞤲𞤮𞤼𞥆𞤢𞥄 𞤫 {language}. 𞤘𞤢𞤲𞤣𞤮 𞤲𞤮𞤼𞥆𞤢𞥄 𞤯𞤵𞤥.",
    chatPlaceholder: "𞤖𞤢𞥄𞤤𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 {language}...",
    aiDisclaimer: "𞤘𞤢𞤲𞤣𞤮 𞤲𞤮 𞤥𞤢𞤱𞤲𞤭 𞤱𞤮𞤶𞥆𞤫. 𞤐𞤣𞤢𞥄𞤪 𞤳𞤮 𞤸𞤢𞥄𞤲𞤭.",
    inputPlaceholder: "𞤖𞤢𞥄𞤤𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 𞤆𞤵𞤤𞤢𞥄𞤪...",
    generating: "𞤘𞤢𞤲𞤣𞤮 𞤲𞤮 𞤥𞤢𞤸𞤢...",
    copy: "𞤐𞤢𞤼𞤵",
    copied: "𞤐𞤢𞤼𞤢𞥄𞤥𞤢",
    output: "𞤒𞤢𞤤𞤼𞤵𞤣𞤫",
    tips: "𞤀𞤥𞤦𞤼𞤫",
    ecommerce: "𞤜𞤲𞤲𞤦𞤮𞤱𞤢𞤩𞤧𞤭",
    ecommercePrompt: "𞤃𞤢𞤸𞤵 𞤣𞤵𞤳𞤢 𞤤𞤢 𞤥𞤼𞤢𞤲𞤣𞤢𞤱𞤭 𞤢𞤬𞤪𞤭𞤳𞤢 𞤱𞤫𞥅𞤤𞤭 𞤲𞤫 𞤢𞤤𞥆𞤵𞤱𞤢𞤤 𞤨𞤭𞥅𞤤𞥆𞤫.",
    languageLearning: "𞤔𞤢𞤲𞤺𞤵𞤺𞤮",
    languageLearningPrompt: "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤶𞤢𞤲𞤺𞤵𞤺𞤮 𞤯𞤫𞤲𞤯𞤫 𞤳𞤫𞤧𞤫.",
    communityHub: "𞤘𞤵𞤩𞥆𞤵",
    communityHubPrompt: "𞤃𞤢𞤸𞤵 𞤨𞤤𞤢𞤼𞤬𞤮𞤪𞤥 𞤱𞤭𞤯𞤭 𞤲𞤢𞤥𞤡𞤵𞤯𞤭𞤩𞥆𞤫 𞤬𞤮𞤪𞤵𞤥𞤶𞤭, ���𞤶𞤭𞤸𞤢𞤤 𞤤𞤢𞤩𞤵𞥅𞤶𞤭 𞤫 𞤧𞤭𞤬𞤲𞤢𞥄𞤶𞤭.",
    you: "𞤀𞤠𞤔𞤖",
    gandoAI: "𞤘𞤢𞤲𞤣𞤮 𞤀𞤋",

    /* docs */
    docsPageTitle: "𞤀𞤬𞤪𞤢𞤥𞤪𞤫 𞤘𞤢𞤲𞤣𞤮",
    docsPageSubtitle: "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 𞤘𞤢𞤲𞤣𞤮",
    docsSection1Title: "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢",
    docsSection1Body: "𞤖𞤢𞥄𞤤𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 𞤆𞤵𞤤𞤢𞥄𞤪 𞤫 𞤘𞤢𞤲𞤣𞤮. 𞤘𞤢𞤲𞤣𞤮 𞤲𞤮𞤼𞥆𞤢𞥄 𞤯𞤵𞤥 𞤫 𞤥𞤢𞤸𞤵 𞤢𞤨𞥆 𞤲𞤮𞥅.",
    docsSection2Title: "𞤖𞤮𞤤𞤭𞤪𞤣𞤫 𞤢𞤨𞥆",
    docsSection2Body: "𞤁𞤢𞤩𞤦𞤮𞤪𞤣𞤫 𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫 𞤱𞤫𞤤𞤭 𞤲𞤮𞥅𞤭 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢. 𞤋𞤲𞤢 𞤑𞤮𞥅𞤣 𞤱𞤫𞤤𞤭 𞤲𞤮𞥅𞤭 𞤱𞤫𞤩𞥆𞤵𞤯𞤭.",
    docsSection3Title: "𞤆𞤮𞤪𞤮𞤶𞤫 𞤏𞤢𞤼𞥆𞤵𞤣𞤫",
    docsSection3Body: "𞤁𞤢𞤩𞤦𞤮𞤪𞤣𞤫 𞤨𞤮𞤪𞤮𞤶𞤫 𞤫 𞤶𞤵𞥅𞤯𞤫 𞤯𞤵𞤥. 𞤖𞤢𞥄𞤤𞤵 𞤱𞤮𞥅𞤪𞤢𞥄 𞤯𞤵𞤥 𞤳𞤮 𞤥𞤢𞤸𞤵 𞤢𞤨𞥆.",

    /* status */
    statusPageTitle: "𞤅𞤭𞤧𞤼𞤫𞤥 𞤅𞤢𞤻𞤮𞤪𞤫",
    statusPageSubtitle: "𞤅𞤢𞤻𞤮𞤪𞤫 𞤘𞤢𞤲𞤣𞤮 𞤸𞤢𞤲𞤳𞤭𞤣𞤫",
    statusServer: "𞤐𞤵𞤲𞤪𞤵",
    statusAI: "𞤘𞤢𞤲𞤣𞤮 𞤀𞤋",
    statusFirebase: "𞤔𞤢𞤴𞤫𞤪𞤦𞤫𞤧",
    statusOperational: "𞤒𞤫𞥅𞤲𞤯𞤭",
    statusDegraded: "𞤏𞤮𞤿𞤢𞥄𞤯𞤭",
    statusDown: "𞤓𞤲𞤢𞥄𞤯𞤭",
    statusChecking: "𞤕𞤫𞥅𞤰𞤭𞤯𞤭...",
    statusLastChecked: "𞤕𞤫𞥅𞤰𞤢𞥄𞤯𞤭 𞤸𞤫𞤩𞥆𞤵𞤣𞤫",
    statusModel: "𞤃𞤮𞤣𞤫𞤤",

    /* misc */
    settings: "𞤚𞤫𞤩𞥆𞤫",
    logout: "𞤒𞤢𞤤𞤼𞤵𞤯𞤮",
    share: "𞤖𞤮𞥅𞤪𞤫",
    deploy: "𞤖𞤵𞥅𞤼𞤮𞤪",
    language: "𞤆𞤓𞤂𞤀𞥄𞤈 (𞤀𞤁𞤂𞤀𞤃)",
    advanced: "𞤒𞤫𞥅𞤧𞤮",
    errorNetwork: "𞤑𞤮 𞤲𞤵𞤥𞤳𞤯𞤢𞤱𞤦𞤫𞤣𞤯𞤮. 𞤀𞤯𞤢 𞤦𞤫𞤙𞤶𞤭𞤩𞤧𞤴𞤧𞤭.",
    errorGeneration: "𞤊𞤭𞤣𞥆𞤭𞥅𞤲𞤣𞤫. 𞤀𞤯𞤢 𞤢𞤺𞤢𞤼𞤢𞥄𞤪𞤭𞤲𞤣𞤫.",
    successGenerated: "𞤀𞤨𞥆 𞤥𞤢𞤸𞤢𞥄𞤯𞤭! 𞤖𞤮𞤤𞥆𞤭𞤪 𞤑𞤮𞥅𞤣 𞤫 𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫.",
    suggestionDashboard: "𞤚𞤢𞤩𞤤𞤮",
    suggestionDashboardPrompt: "𞤃𞤢𞤸𞤵 𞤼𞤢𞤩𞤤𞤮 𞤶𞤢𞤥𞤢𞥄𞤲𞤵 𞤲𞤺𞤢𞤥 𞤢𞤲𞤢𞤤𞤭𞤧.",
    suggestionLearning: "𞤔𞤢𞤲𞤺𞤵𞤺𞤮",
    suggestionLearningPrompt: "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤶𞤢𞤲𞤺𞤵𞤺𞤮 𞤯𞤫𞤲𞤯𞤫 𞤳𞤫𞤧𞤫.",
    suggestionBusiness: "𞤐𞤶𞤫𞥅𞤴𞤺𞤵",
    suggestionBusinessPrompt: "𞤃𞤢𞤸𞤵 𞤶𞤢𞥄𞤪𞤮𞥅𞤪𞤫 𞤱𞤫𞤦 𞤲𞤶𞤫𞥅𞤴𞤺𞤵 𞤸𞤢𞤲𞥆𞤣𞤫𞥅𞤪𞤭.",
  },

  /* ═══════════════════════════════════════
     FRANÇAIS
  ═══════════════════════════════════════ */
  fr: {
    appName: "Gando",
    loginWithGoogle: "Continuer avec Google",
    heroTitle: "Créez des apps avec Gando AI.",
    heroSubtitle: "Le constructeur d'applications moderne pour l'Afrique. Décrivez votre vision dans votre langue maternelle.",
    beta: "Bêta Publique",
    errorAuth: "Erreur d'authentification. Veuillez vous reconnecter.",

    dashboardNav: "Tableau de bord",
    projectsNav: "Projets",
    assetsNav: "Ressources",
    searchPlaceholder: "Rechercher dans Gando…",

    myProjectsLabel: "Mes Projets",
    languageAssetsLabel: "Ressources Linguistiques",
    settingsNav: "Paramètres",
    teamHubLabel: "Équipe",
    newProject: "Nouveau Projet",
    documentationLabel: "Documentation",
    systemStatusLabel: "État du Système",
    signOut: "Déconnexion",
    projectsCreatedLabel: "Projets Créés",

    profile: "Profil",
    viewProfile: "Voir le Profil",

    gandoViewTitle: "Vue Gando",
    gandoViewSubtitle: "Créez des applications dans votre langue africaine",
    projectsLabel: "Projets",
    appsBuiltLabel: "Apps Créées",
    generateLabel: "GÉNÉRER",
    activeSiteBuildsLabel: "Projets Actifs",
    viewAllLabel: "Voir Tout",
    projectCompletionLabel: "Avancement des Projets",
    completionSubtitle: "Progression globale de vos projets Gando.",
    tokenUsageLabel: "Tokens Utilisés",
    tokenResetHint: "Utilisation dans les limites normales.",
    healthyLabel: "Sain",
    appPerformanceLabel: "Performance",
    excellentLabel: "Excellent",
    latencyLabel: "Latence",
    uptimeLabel: "Disponibilité",
    runtimeLabel: "Runtime",
    totalFlowLabel: "Flux Total",
    appsGeneratedLabel: "Apps Générées",
    totalPromptsLabel: "Total Prompts",
    noProjectsTitle: "Aucun projet",
    noProjectsSubtitle: "Décrivez votre app ci-dessus et cliquez Générer.",

    projectsPageTitle: "Mes Projets",
    projectsPageSubtitle: "Tous vos projets générés par Gando AI",
    searchProjectsPlaceholder: "Rechercher un projet…",
    deleteProjectLabel: "Supprimer",
    openProjectLabel: "Ouvrir",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce projet ?",
    recentProjects: "Projets Récents",

    preview: "Aperçu",
    code: "Code",
    download: "Télécharger",
    rename: "Renommer",
    deleteConfirm: "Êtes-vous sûr de vouloir supprimer ce projet ?",
    revertLabel: "Revenir",
    currentVersionLabel: "Version Actuelle",

    chatWelcome: "Que vas-tu construire aujourd'hui ?",
    chatSubtitle: "Décrivez votre vision en {language}. Gando AI s'occupe du reste.",
    chatPlaceholder: "Décrivez votre application en {language}...",
    aiDisclaimer: "Gando AI peut faire des erreurs. Vérifiez les informations importantes.",
    inputPlaceholder: "Décrivez votre application en Français...",
    generating: "Gando construit...",
    copy: "Copier",
    copied: "Copié",
    output: "Sortie",
    tips: "Conseils",
    ecommerce: "Boutique en Ligne",
    ecommercePrompt: "Créer une boutique africaine moderne avec catalogue produits et panier.",
    languageLearning: "Apprentissage",
    languageLearningPrompt: "Créer une app éducative pour apprendre les langues africaines.",
    communityHub: "Centre Communautaire",
    communityHubPrompt: "Créer une plateforme communautaire avec forums et événements locaux.",
    you: "Vous",
    gandoAI: "Gando AI",

    docsPageTitle: "Documentation Gando",
    docsPageSubtitle: "Tout ce que vous devez savoir pour utiliser Gando AI",
    docsSection1Title: "Créer votre première app",
    docsSection1Body: "Décrivez simplement l'app que vous souhaitez créer dans votre langue. Gando AI comprend le français, l'anglais, le fulani et bien d'autres langues africaines. Soyez précis : mentionnez le type d'app, les fonctionnalités souhaitées et le public cible.",
    docsSection2Title: "Prévisualiser et modifier",
    docsSection2Body: "Après génération, utilisez l'onglet Aperçu pour voir votre app en temps réel. Basculez sur Code pour inspecter ou modifier le HTML/CSS/JS. Continuez la conversation pour itérer — dites simplement ce que vous voulez changer.",
    docsSection3Title: "Gérer vos projets",
    docsSection3Body: "Tous vos projets sont sauvegardés automatiquement dans la section Projets. Cliquez sur un projet pour le rouvrir, renommez-le en cliquant sur son titre, ou supprimez-le depuis la liste.",

    statusPageTitle: "État du Système",
    statusPageSubtitle: "Surveillance en temps réel de Gando AI",
    statusServer: "Serveur",
    statusAI: "Modèle IA",
    statusFirebase: "Base de données",
    statusOperational: "Opérationnel",
    statusDegraded: "Dégradé",
    statusDown: "Hors ligne",
    statusChecking: "Vérification…",
    statusLastChecked: "Dernière vérification",
    statusModel: "Modèle",

    settings: "Paramètres",
    logout: "Déconnexion",
    share: "Partager",
    deploy: "Déployer",
    language: "FRANÇAIS",
    advanced: "Avancé",
    errorNetwork: "Erreur réseau. Veuillez réessayer.",
    errorGeneration: "Erreur de génération. Réessayez avec une description différente.",
    successGenerated: "App générée ! Explorez le code et l'aperçu.",
    suggestionDashboard: "Tableau de bord",
    suggestionDashboardPrompt: "Créez un tableau de bord analytique moderne avec des graphiques.",
    suggestionLearning: "Apprentissage",
    suggestionLearningPrompt: "Créez une application éducative pour apprendre de nouvelles langues.",
    suggestionBusiness: "Entreprise",
    suggestionBusinessPrompt: "Créez une page de destination professionnelle pour votre entreprise.",
  },

  /* ═══════════════════════════════════════
     ENGLISH
  ═══════════════════════════════════════ */
  en: {
    appName: "Gando",
    loginWithGoogle: "Continue with Google",
    heroTitle: "Build apps with Gando AI.",
    heroSubtitle: "The modern app builder for Africa. Describe your vision in your native tongue and watch it come to life.",
    beta: "Public Beta",
    errorAuth: "Authentication failed. Please sign in again.",

    dashboardNav: "Dashboard",
    projectsNav: "Projects",
    assetsNav: "Assets",
    searchPlaceholder: "Search Gando…",

    myProjectsLabel: "My Projects",
    languageAssetsLabel: "Language Assets",
    settingsNav: "Settings",
    teamHubLabel: "Team Hub",
    newProject: "New Project",
    documentationLabel: "Documentation",
    systemStatusLabel: "System Status",
    signOut: "Sign Out",
    projectsCreatedLabel: "Projects Created",

    profile: "Profile",
    viewProfile: "View Profile",

    gandoViewTitle: "Gando View",
    gandoViewSubtitle: "Build apps in your African language",
    projectsLabel: "Projects",
    appsBuiltLabel: "Apps Built",
    generateLabel: "GENERATE",
    activeSiteBuildsLabel: "Active Site Builds",
    viewAllLabel: "View All",
    projectCompletionLabel: "Project Completion",
    completionSubtitle: "Overall progress across your Gando projects and linguistic builds.",
    tokenUsageLabel: "Tokens Used",
    tokenResetHint: "Utilization is within healthy bounds.",
    healthyLabel: "Healthy",
    appPerformanceLabel: "App Performance",
    excellentLabel: "Excellent",
    latencyLabel: "Latency",
    uptimeLabel: "Uptime",
    runtimeLabel: "Runtime",
    totalFlowLabel: "Total Flow",
    appsGeneratedLabel: "Apps Generated",
    totalPromptsLabel: "Total Prompts",
    noProjectsTitle: "No projects yet",
    noProjectsSubtitle: "Describe your app above and hit Generate to start building.",

    projectsPageTitle: "My Projects",
    projectsPageSubtitle: "All your projects generated by Gando AI",
    searchProjectsPlaceholder: "Search projects…",
    deleteProjectLabel: "Delete",
    openProjectLabel: "Open",
    confirmDelete: "Are you sure you want to delete this project?",
    recentProjects: "Recent Projects",

    preview: "Preview",
    code: "Code",
    download: "Download",
    rename: "Rename",
    deleteConfirm: "Are you sure you want to delete this project?",
    revertLabel: "Revert",
    currentVersionLabel: "Current",

    chatWelcome: "What will you build today?",
    chatSubtitle: "Describe your vision in {language}. Gando AI handles the rest.",
    chatPlaceholder: "Describe your app in {language}...",
    aiDisclaimer: "Gando AI can make mistakes. Check important info.",
    inputPlaceholder: "Describe your app in English...",
    generating: "Gando is building...",
    copy: "Copy",
    copied: "Copied",
    output: "Output",
    tips: "Tips",
    ecommerce: "E-Commerce Store",
    ecommercePrompt: "Create a modern African e-commerce store with product listings, shopping cart, and payment integration.",
    languageLearning: "Language Learning",
    languageLearningPrompt: "Build an interactive app for learning African languages with lessons and progress tracking.",
    communityHub: "Community Hub",
    communityHubPrompt: "Design a community platform for connecting locals with forums and event listings.",
    you: "You",
    gandoAI: "Gando AI",

    docsPageTitle: "Gando Documentation",
    docsPageSubtitle: "Everything you need to know to build with Gando AI",
    docsSection1Title: "Creating your first app",
    docsSection1Body: "Simply describe the app you want to create in your language. Gando AI understands English, French, Fulani (ADLaM), Swahili, Yoruba, Hausa, and many more African languages. Be specific: mention the app type, desired features, and target audience for best results.",
    docsSection2Title: "Previewing and editing",
    docsSection2Body: "After generation, use the Preview tab to see your app live in a real browser. Switch to Code to inspect or manually edit the HTML/CSS/JS. Continue chatting to iterate — just say what you want changed and Gando will update only that part.",
    docsSection3Title: "Managing your projects",
    docsSection3Body: "All your projects are automatically saved. Open the Projects section to see your full library, search by name, open any project to continue building, or delete ones you no longer need. Click a project's title in the workspace to rename it.",

    statusPageTitle: "System Status",
    statusPageSubtitle: "Real-time monitoring of Gando AI services",
    statusServer: "Server",
    statusAI: "AI Model",
    statusFirebase: "Database",
    statusOperational: "Operational",
    statusDegraded: "Degraded",
    statusDown: "Down",
    statusChecking: "Checking…",
    statusLastChecked: "Last checked",
    statusModel: "Model",

    settings: "Settings",
    logout: "Logout",
    share: "Share",
    deploy: "Deploy",
    language: "ENGLISH",
    advanced: "Advanced",
    errorNetwork: "Network error. Please try again later.",
    errorGeneration: "Generation error. Try again with a different description.",
    successGenerated: "App generated! Explore the code and preview.",
    suggestionDashboard: "Dashboard",
    suggestionDashboardPrompt: "Build a modern analytics dashboard with charts.",
    suggestionLearning: "Learning",
    suggestionLearningPrompt: "Create an educational app for learning new languages.",
    suggestionBusiness: "Business",
    suggestionBusinessPrompt: "Make a professional business landing page.",
  }
};
