export type LanguageCode = 'ff-adlm' | 'fr' | 'en';

export interface UIStrings {
  /* auth */
  appName: string;
  loginWithGoogle: string;
  heroTitle: string;
  heroSubtitle: string;
  loginEyebrow: string;
  loginLine1: string;
  loginLine2: string;
  loginLine3: string;
  beta: string;
  errorAuth: string;

  /* nav */
  dashboardNav: string;
  projectsNav: string;
  assetsNav: string;
  searchPlaceholder: string;

  /* sidebar */
  myProjectsLabel: string;
  templatesNav: string;
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
  shareLabel: string;
  sharePendingLabel: string;
  shareLiveLabel: string;
  shareConfirm: string;
  communityTitle: string;
  remixLabel: string;
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
  collectorLabel: string;
  chatsLabel: string;
  recentsHeader: string;
  settingsGeneralTab: string;
  settingsAccountTab: string;
  settingsPrivacyTab: string;
  avatarLabel: string;
  avatarSubtitle: string;
  fullNameLabel: string;
  fullNameSubtitle: string;
  gandoNamingQuery: string;
  gandoNamingSubtitle: string;
  workDescriptionQuery: string;
  appearanceLabel: string;
  appearanceSubtitle: string;
  roleStudent: string;
  roleEngineering: string;
  roleProductManagement: string;
  roleDesign: string;
  roleDataScience: string;
  roleScience: string;
  roleBusiness: string;
  roleMarketing: string;
  roleOperations: string;
  roleEducation: string;
  roleOther: string;
  logOutActionLabel: string;
  logOutActionSubtitle: string;
  deleteAccountActionLabel: string;
  deleteAccountActionSubtitle: string;
  privacyBriefHeader: string;
  improveModelsLabel: string;
  improveModelsSubtitle: string;
  preciseLocationLabel: string;
  preciseLocationSubtitle: string;
  exportDataLabel: string;
  exportDataSubtitle: string;
  signIn: string;
  getStarted: string;
  twPhrases: string[];
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
    appName: "𞤘𞤢𞤲𞤣𞤮",
    loginWithGoogle: "𞤘𞤵𞥅𞤺𞤮𞤤 𞤫 𞤔𞤮𞤳𞥆𞤵",
    heroTitle: ".𞤘𞤢𞤲𞤣𞤮 𞤦𞤢𞤤𞥆𞤢𞤤 𞤫 𞤢𞤨𞥆𞤧 𞤃𞤢𞤸𞤵",
    heroSubtitle: ".𞤤𞤢𞥄𞤼𞤮𞥅 𞤲𞤮 𞤯𞤵𞤥 𞤢𞤲𞤣𞤢𞥄𞤪𞤢 𞤢 𞤲𞤺𞤢𞤥 𞤥𞤢𞤥 𞤥𞤢𞥄𞤯𞤢 𞤯𞤫𞤲𞤯𞤢𞤤 𞤫 𞤲𞤮𞤼𞥆𞤢𞥄 𞤳𞤮 𞤅𞤭𞤬𞤢𞥄 .𞤀𞤬𞤪𞤭𞤳𞤢 𞤲𞤺𞤢𞤥 𞤶𞤢𞤥𞤢𞥄𞤲𞤵 𞤢𞤨𞥆𞤧 𞤏𞤢𞤸𞤮𞥅𞤱𞤮",
    loginEyebrow: "𞤀𞤊𞤪𞤭𞤳𞤢 𞤐𞤘𞤢𞤃 · 𞤘𞤢𞤲𞤣𞤮",
    loginLine1: "𞤢𞤨𞥆𞤧𞤶𞤭 𞤃𞤢𞤸𞤵𞤣𞤫",
    loginLine2: "𞤫𞤲𞤣𞤫𞤪 𞤫",
    loginLine3: ".𞤥𞤢𞤥 𞤥𞤢𞥄𞤯𞤢 𞤯𞤫𞤲𞤯𞤢𞤤",
    beta: "𞤒𞤫𥅼𞤮 𞤘𞤢𞤲𞤣𞤮",
    errorAuth: ".𞤳𞤢𞤯𞤭𞤼𞤵𞤲 𞤥𞤢𞤧𞤭𞤲 𞤫 𞤔𞤮𞤳𞥆𞤵 .𞤱𞤢𞤲𞤢𞥄 𞤲𞤮 𞤤𞤭𞤥𞤮𞥅𞤪𞤫 𞤊𞤭𞤣𞥆𞤭𞥅𞤲𞤣𞤫",
    dashboardNav: "𞤚𞤢𞤩𞤤𞤮",
    projectsNav: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    assetsNav: "𞤔𞤢𞤱𞤣𞤭",
    searchPlaceholder: "…𞤘𞤢𞤲𞤣𞤮 𞤫𞤲𞤣𞤫𞤪 𞤫 𞤊𞤭𞤤𞥆𞤮",
    myProjectsLabel: "𞤢𞤥 𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    templatesNav: "𞤐𞤭𞥅𞤧𞤢𞥄𞤯𞤭",
    languageAssetsLabel: "𞤍𞤫𞤥𞤯𞤫 𞤔𞤢𞤱𞤣𞤭",
    settingsNav: "𞤚𞤫𞤩𞥆𞤫",
    teamHubLabel: "𞤘𞤮𞤤𞥆𞤭𞤣𞤫 𞤔𞤵𞥅𞤯𞤫",
    newProject: "𞤳𞤫𞤧𞤮 𞤆𞤮𞤪𞤮𞤶𞤫",
    documentationLabel: "𞤁𞤫𞤬𞤼𞤫𞤪𞤣𞤵",
    systemStatusLabel: "𞤅𞤭𞤧𞤼𞤫𞤥 𞤐𞤮𞤲𞥆𞤣𞤫",
    signOut: "𞤒𞤢𞤤𞤼𞤵𞤯𞤫",
    projectsCreatedLabel: "𞤃𞤢𞤸𞤢𞥄𞤯𞤭 𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    profile: "𞤔𞤮𞤥 𞤐𞤮𞤲𞥆𞤣𞤫",
    viewProfile: "𞤐𞤮𞤲𞥆𞤣𞤫 𞤐𞤣𞤢𞥄𞤪",
    gandoViewTitle: "𞤘𞤢𞤲𞤣𞤮 𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫",
    gandoViewSubtitle: "𞤀𞤬𞤪𞤭𞤳𞤢𞤲 𞤯𞤫𞤲𞤯𞤢𞤤 𞤫 𞤢𞤨𞥆𞤧 𞤃𞤢𞤸𞤵𞤣𞤫",
    projectsLabel: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    appsBuiltLabel: "𞤃𞤮𞤷𞥆𞤭𞤲𞤢𞥄𞤯𞤭 𞤀𞤨𞥆𞤧",
    generateLabel: "𞤃𞤢𞤸𞤵",
    activeSiteBuildsLabel: "𞤒𞤢𞥄𞤪𞤢 𞤐𞤮 𞤃𞤢𞤸𞤵𞤣𞤫",
    viewAllLabel: "𞤖𞤢𞤲𞥆𞤣𞤫 𞤑𞤮 𞤐𞤣𞤢𞥄𞤪",
    projectCompletionLabel: "𞤏𞤢𞤼𞤵𞤣𞤫 𞤆𞤮𞤪𞤮𞤶𞤫",
    completionSubtitle: ".𞤥𞤢𞥄𞤯𞤢 𞤘𞤢𞤲𞤣𞤮 𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤲𞤣𞤫 𞤫 𞤴𞤫𞥅𞤧𞤮 𞤒𞤢𞥄𞤪𞤵𞤺𞤮𞤤",
    tokenUsageLabel: "𞤖𞤵𞥅𞤼𞤮𞤪𥆪𞤢𞥄𞤯𞤭 𞤚𞤢𞤤𞤳𞤵𞥅𞤪𞤭",
    tokenResetHint: ".𞤮𞤲𞤣𞤢𞤥 𞤲𞤣𞤫𞤪 𞤫 𞤲𞤮 𞤖𞤵𞥅𞤼𞤮𞤪𥆪𞤢𞥄𞤯𞤭",
    healthyLabel: "𞤌𞤲𞤣𞤢𞤥",
    appPerformanceLabel: "𞤀𞤨𞥆 𞤒𞤢𞥄𞤪𞤵𞤺𞤮𞤤",
    excellentLabel: "𞤇𞤫𞥅𞤯𞤢𞤲",
    latencyLabel: "𞤔𞤢𞥄𞤤𞤫𞤤",
    uptimeLabel: "𞤒𞤫𞥅𞤲𞤯𞤭𞤲𞤣𞤫",
    runtimeLabel: "𞤘𞤮𞤤𞥆𞤫 𞤚𞤢𞤩𞤤𞤮",
    totalFlowLabel: "𞤖𞤢𞤻𞤫𞥅𞤲𞤣𞤫 𞤒𞤢𞥄𞤪𞤵𞤣𞤫",
    appsGeneratedLabel: "𞤃𞤢𞤸𞤄𞥄𞤯𞤭 𞤀𞤨𞥆𞤧",
    totalPromptsLabel: "𞤖𞤢𞤻𞤫𞥅𞤲𞤣𞤫 𞤖𞤢𞥄𞤤𞤵𞥅𞤶𞤭",
    noProjectsTitle: "𞤶𞤮𞤲𞤭 𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤏𞤢𞤤𞤢𞥄",
    noProjectsSubtitle: ".𞤃𞤢𞤸𞤵 𞤲𞤮𞤼𞥆𞤢 𞤢 𞤲𞤺𞤢𞤥 𞤣𞤮𞥅 𞤯𞤮𞥅 𞤥𞤢𞥄𞤯𞤢 𞤢𞤨𞥆 𞤅𞤭𞤬𞤢𞥄",
    projectsPageTitle: "𞤢𞤥 𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    projectsPageSubtitle: "𞤫𞤢 𞤘𞤢𞤲𞤣𞤮 𞤦𞤢𞤤𞥆𞤢𞤤 𞤫 𞤥𞤢𞤸𞤢𞥄𞤯𞤭 𞤥𞤢𞥄𞤯𞤢 𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤑𞤮",
    searchProjectsPlaceholder: "…𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤊𞤭𞤤𞥆𞤮",
    deleteProjectLabel: "𞤃𞤮𞤥𞤼𞤵",
    openProjectLabel: "𞤌𞤯𥥆𞤵𞤼𞤵",
    shareLabel: "𞤅𞤫𞤲𞤣𞤵",
    sharePendingLabel: "𞤆𞤢𞤣𞥆𞤢𞥄𞤺𞤮",
    shareLiveLabel: "𞤉 𞤲𞤣𞤫𞤪 𞤘𞤢𞤤𞤫𞤪𞤭",
    shareConfirm: "𞤪𞤫𞤲𞥆𞤣𞤮? 𞤘𞤢𞤤𞤫𞤪𞤭 𞤲𞤣𞤫𞤪 𞤫 𞤯𞤮𞥅 𞤨𞤮𞤪𞤮𞤶𞤫 𞤲𞤫𞤤𞤣𞤵𞤣𞤫 𞤴𞤭𞤯𞤭 𞤀𞤯𞤢",
    communityTitle: "𞤋𞤱𞤣𞤫 𞤫 𞤪𞤫𞤲𞥆𞤣𞤮",
    remixLabel: "𞤏𞤢𞤴𞤤𞤵𞤣𞤫",
    confirmDelete: "𞤯𞤮𞥅? 𞤨𞤮𞤪𞤮𞤶𞤫 𞤥𞤮𞤥𞤼𞤵𞤣𞤫 𞤴𞤭𞤯𞤭 𞤢 𞤤𞤢𞥄𞤩𞤭 𞤀𞤯𞤢",
    recentProjects: "𞤇𞤫𞤲𞥆𞤵𞤯𞤭 𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭",
    preview: "𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫",
    code: "𞤑𞤮𞥅𞤣",
    download: "𞤔𞤭𞤨𞥆𞤭𞤲𞤣𞤫",
    rename: "𞤋𞤲𞥆𞤵𞤼𞤵",
    deleteConfirm: "𞤯𞤮𞥅? 𞤨𞤮𞤪𞤮𞤶𞤫 𞤥𞤮𞤥𞤼𞤵𞤣𞤫 𞤴𞤭𞤯𞤭 𞤢 𞤤𞤢𞥄𞤩𞤭 𞤀𞤯𞤢",
    revertLabel: "𞤊𞤭𞤤𞤼𞤵",
    currentVersionLabel: "𞤖𞤢𞤲𞤳𞤭𞤲",
    chatWelcome: "𞤖𞤮𞤲𞤯𞤵𞤲 𞤥𞤢𞤸𞤢𞤼𞤫𞤲 𞤸𞤢𞤲𞤣𞤫?",
    chatSubtitle: ".𞤸𞤫𞤯𞥆𞤭 𞤳𞤮 𞤶𞤮𞤺𞤭𞥅 𞤲𞤮 𞤘𞤢𞤲𞤣𞤮 .{language} 𞤲𞤣𞤫𞤪 𞤫 𞤲𞤮𞤼𞥆𞤢𞥄 𞤳𞤮 𞤅𞤭𞤬𞤢𞥄",
    chatPlaceholder: "…{language} 𞤲𞤣𞤫𞤪 𞤫 𞤥𞤢𞥄𞤯𞤢 𞤢𞤨𞥆 𞤅𞤭𞤬𞤢𞥄",
    aiDisclaimer: "𞤘𞤢𞤲𞤣𞤮 𞤫𞤢 𞤲𞤮 𞤱𞤢𞥄𞤱𞤭 𞤬𞤢𞤤𞤶𞤵𞤣𞤫. 𞤐𞤣𞤢𞥄𞤪 𞤳𞤮 𞤸𞤢𞥄𞤲𞤭.",
    inputPlaceholder: "…𞤆𞤵𞤤𞤢𞥄𞤪 𞤲𞤣𞤫𞤪 𞤫 𞤥𞤢𞥄𞤯𞤢 𞤢𞤨𞥆 𞤅𞤭𞤬𞤢𞥄",
    collectorLabel: "𞤃𞤮𞥅𞤬𞤼𞤮𞥅𞤱𞤮",
    chatsLabel: "𞤟𞤫𞤱𞤼𞤫𞤪𞤫𞥅𞤶𞤭",
    recentsHeader: "𞤇𞤉𞤐𞥆𞤓𞤦𞤭",
    settingsGeneralTab: "𞤑𞤢𞥄𞤥𞤵",
    settingsAccountTab: "𞤂𞤭𞤥𞤮𞥅𞤪𞤫",
    settingsPrivacyTab: "𞤅𞤵𞥅𞤯𞤢𞥄𞤪𞤫",
    avatarLabel: "𞤴𞤫𞥅𞤧𞤮 𞤐𞤢𞤼𞤢𞤤",
    avatarSubtitle: "𞤥𞤢𞥄𞤯𞤢 𞤐𞤢𞤼𞤢𞤤 𞤱𞤢𞤴𞤤𞤵𞤣𞤫 𞤲𞤺𞤢𞤥 𞤐𞤮𞤼𞥆𞤵",
    fullNameLabel: "𞤔𞤢𞤥𞥆𞤮𞥅𞤪𞤫 𞤫 𞤋𞤲𞤣𞤫",
    fullNameSubtitle: "𞤴𞤫𞤼𞥆𞤮𞥅𞤪𞤫 𞤫 𞤋𞤲𞤣𞤫",
    gandoNamingQuery: "𞤥𞤢? 𞤭𞤲𥆇𞤵𞤺𞤮𞤤 𞤸𞤢𞤢𞤲𞤭 𞤘𞤢𞤲𞤣𞤮 𞤸𞤮𞤲𥆇𞤮 𞤑𞤮",
    gandoNamingSubtitle: "𞤥𞤢𞥄𞤯𞤢 𞤶𞤮𞤥𞥆𞤭𞤲𞤺𞤮𞤤 𞤲𞤣𞤫𞤪 𞤫 𞤸𞤵𞥅𞤼𞤮𞤪𥆪𞤫𞥅 𞤐𞤮",
    workDescriptionQuery: "𞤥𞤢𞥄𞤯𞤢? 𞤺𞤮𞤤𞥆𞤢𞤤 𞤧𞤭𞤬𞤢𞥄𞤣𞤫 𞤩𞤵𞤪𞤭 𞤖𞤮𞤲𞤯𞤵𞤥",
    appearanceLabel: "𞤐𞤣𞤄𥄃𞤪𞤭 𞤃𞤮𞥅𞤣𞤭",
    appearanceSubtitle: "𞤂𞤫𞥅𞤤𞤫𞤱𞤢𞤤 𞤥𞤢𞥄 𞤔𞤢𞤴𞤲𞤺𞤮𞤤",
    roleStudent: "𞤔𞤢𞤲𞤺𞤮𞥅𞤱𞤮",
    roleEngineering: "𞤅𞤭𞤧𞤼𞤫𞤥 𞤚𞤢𞤬𥥆𞤮𞥅𞤱𞤮",
    roleProductManagement: "𞤔𞤢𞤱𞤣𞤭 𞤔𞤮𞤥𥥆𞤭𞤲𞤺𞤮𞤤",
    roleDesign: "𞤐𞤢𞤼𞤢𞤤 𞤅𞤢𞤻𞤮𞤪𞤫",
    roleDataScience: "𞤘𞤮𞤤𞥆𞤭𞤪𞤯𞤭 𞤘𞤢𞤲𞤣𞤢𞤤",
    roleScience: "𞤘𞤢𞤲𞤣𞤢𞤤",
    roleBusiness: "𞤐𞤶𞤫𞥅𞤴𞤺𞤵",
    roleMarketing: "𞤐𞤶𞤫𞥅𞤴𞤺𞤵 𞤖𞤮𞤤𞥆𞤭𞤼𞤵𞤣𞤫",
    roleOperations: "𞤘𞤮𞤤𞥆𞤫 𞤒𞤢𞥄𞤪𞤵𞤣𞤫",
    roleEducation: "𞤔𞤢𞤲𞤺𞤭𞤲𞤣𞤫",
    roleOther: "𞤔𞤢𞤽𞤼𞤢𞥄𞤯𞤭",
    logOutActionLabel: "𞤥𞤢𞤧𞤭𞤲 𞤫 𞤒𞤢𞤤𞤼𞤵",
    logOutActionSubtitle: "𞤯𞤮𞥅 𞤥𞤢𞤧𞤭𞤲 𞤲𞤣𞤫𞤪 𞤫 𞤒𞤢𞤤𞤼𞤵𞤣𞤫",
    deleteAccountActionLabel: "𞤂𞤭𞤥𞤮𞥅𞤪𞤫 𞤃𞤮𞤥𞤼𞤵",
    deleteAccountActionSubtitle: ".𞤬𞤭𞤤𞤼𞤢𞥄𞤺𞤮𞤤 𞤱𞤢𞤤𞤄𞥄 𞤥𞤮𞤥𞤼𞤢𞥄𞤥𞤢 𞤇𞤫𞤲𞥆𞤵𞤯𞤮 .𞤶𞤫𞤱𞤼𞤫𞤪𞤫𞥅𞤶𞤭 𞤫 𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 ,𞤤𞤭𞤥𞤮𞥅𞤪𞤫 𞤥𞤢𞥄𞤯𞤢 𞤥𞤮𞤥𞤼𞤭𞤪𞤢𞤲 𞤤𞤢𞥄𞤦𞤭 𞤲𞤺𞤮𞥅𞤤 𞤃𞤮𞤥𞤼𞤵𞤣𞤫",
    privacyBriefHeader: ".𞤤𞤫𞤧 𞤯𞤮𞥅 𞤯𞤵𞤥 𞤒𞤢𞥄𞤪𞤵𞤣𞤫 𞤱𞤢𞥄𞤱𞤭 𞤀𞤯𞤢 .𞤥𞤢𞥄𞤯𞤢 𞤺𞤮𞤤𞥆𞤭𞤪𞤯𞤭 𞤲𞤣𞤫𞤪 𞤫 𞤤𞤢𞥄𞤩𞤢𞤤 𞤶𞤮𞤺𞤭𞥅 𞤲𞤮 𞤃𞤭𞤲",
    improveModelsLabel: "𞤫𞤢 𞤘𞤢𞤲𞤣𞤮 𞤥𞤮𞤷𞥆𞤭𞤲𞤣𞤫 𞤏𞤢𞤤𥆪𞤵",
    improveModelsSubtitle: ".𞤘𞤢𞤲𞤣𞤮 𞤥𞤮𞤷𞥆𞤭𞤲𞤣𞤫 𞤫 𞤶𞤢𞤲𞤺𞤭𞤲𞤣𞤫 𞤲𞤺𞤢𞤥 𞤥𞤢𞥄𞤯𞤢 𞤶𞤫𞤱𞤼𞤫𞤪𞤫𞥅𞤶𞤭 𞤐𞤫𞤤𞤣𞤵",
    preciseLocationLabel: "𞤂𞤢𞥄𞤩𞤵𞤲𞤣𞤫 𞤐𞤮𞤳𞥆𞤵𞥅𞤪𞤫",
    preciseLocationSubtitle: ".𞤲𞤫𞤼𞤱𞤮𞤪𞤳 𞤲𞤣𞤫𞤪 𞤫 𞤥𞤢𞥄𞤯𞤢 𞤺𞤢𞤤𞥆𞤵𞥅𞤪𞤫 𞤶𞤮𞤺𞤭𞥅 𞤲𞤮 𞤃𞤭𞤲 .𞤱𞤫𞥅𞤤𞤭 𞤐𞤮",
    exportDataLabel: "𞤺𞤮𞤤𞥆𞤭𞤪𞤯𞤭 𞤟𞤢𞥄𞤪𞤵",
    exportDataSubtitle: "(𞤔𞤅𞤌𞤐) 𞤶𞤫𞤱𞤼𞤫𞤪𞤫𞥅𞤶𞤭 𞤫 𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤔𞤭𞤨𞥆𞤭𞤲𞤣𞤫",
    signIn: "𞤐𞤢𞥄𞤼𞤵",
    getStarted: "𞤊𞤵𞤯𞥆𞤮",
    twPhrases: [
      "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤫 𞤆𞤵𞤤𞤢𞥄𞤪 𞤫 𞤀𞤁𞤂𞤀𞤃…",
      "𞤃𞤢𞤸𞤵 𞤤𞤢 𞤥𞤼𞤢𞤲𞤣𞤢𞤱𞤭 𞤲𞤺𞤢𞤥 𞤀𞤬𞤪𞤭𞤳𞤢…",
      "𞤃𞤢𞤸𞤵 𞤢𞤨𞥆 𞤶𞤢𞤲𞤺𞤵𞤺𞤮 𞤯𞤫𞤲𞤯𞤢𞤤 𞤥𞤢𞥄𞤯𞤢…",
      "𞤃𞤢𞤸𞤵 𞤨𞤤𞤢𞤼𞤬𞤮𞤪𞤥 𞤲𞤺𞤢𞤥 𞤀𞤬𞤪𞤭𞤳𞤢…",
    ],
    generating: "𞤘𞤢𞤲𞤣𞤮 𞤲𞤮 𞤥𞤢𞤸𞤢…",
    copy: "𞤐𞤢𞤼𞤵",
    copied: "𞤐𞤢𞤼𞤢𞥄𞤥𞤢",
    output: "𞤒𞤢𞤤𞤼𞤵𞤣𞤫",
    tips: "𞤄𞤢𞤤𞥆𞤢𞤤 𞤐𞤣𞤫𞤪",
    ecommerce: "𞤐𞤫𞤼𞤱𞤮𞤪𞤳 𞤫 𞤁𞤵𞤳𞥆𞤢𞥄𞤲𞤭",
    ecommercePrompt: "…𞤀𞤬𞤪𞤭𞤳𞤢 𞤲𞤺𞤢𞤥 𞤶𞤢𞤥𞤢𞥄𞤲𞤵 𞤣𞤵𞤳𞥆𞤢𞥄𞤲𞤭 𞤃𞤮𞤷𞥆𞤭𞤲𞤣𞤫",
    languageLearning: "𞤍𞤫𞤥𞤯𞤫 𞤔𞤢𞤲𞤺𞤭𞤲𞤣𞤫",
    languageLearningPrompt: "…𞤀𞤬𞤪𞤭𞤳𞤢 𞤯𞤫𞤲𞤯𞤫 𞤶𞤢𞤲𞤺𞤭𞤲𞤣𞤫 𞤢𞤨𞥆 𞤃𞤢𞤸𞤵𞤣𞤫",
    communityHub: "𞤈𞤫𞤲𞥆𞤣𞤮 𞤚𞤢𞤩𞤤𞤮",
    communityHubPrompt: "…𞤴𞤭𞤥𞤩𞤫 𞤶𞤮𞤳𞥆𞤵𞤣𞤫 𞤲𞤺𞤢𞤥 𞤨𞤤𞤢𞤼𞤬𞤮𞤪𞤥 𞤅𞤢𞤻𞤮𞤪𞤫",
    you: "𞤀𞤲𞥆𞤢",
    gandoAI: "𞤉𞤢 𞤘𞤢𞤲𞤣𞤮",
    docsPageTitle: "𞤁𞤫𞤬𞤼𞤫𞤪𞤣𞤵 𞤘𞤢𞤲𞤣𞤮",
    docsPageSubtitle: "𞤫𞤢 𞤘𞤢𞤲𞤣𞤮 𞤦𞤢𞤤𞥆𞤢𞤤 𞤫 𞤥𞤢𞤸𞤵𞤣𞤫 𞤲𞤺𞤢𞤥 𞤶𞤢𞤲𞤺𞤵 𞤢 𞤸𞤢𞤲𥥆𞤣𞤫 𞤑𞤮",
    docsSection1Title: "𞤳𞤫𞤧𞤮 𞤢𞤨𞥆 𞤥𞤢𞥄𞤯𞤢 𞤃𞤮𞤷𞥆𞤭𞤲𞤣𞤫",
    docsSection1Body: "…𞤸𞤢𞤻𞤫𞥅𞤲𞤣𞤫 𞤀𞤬𞤪𞤭𞤳𞤢 𞤯𞤫𞤲𞤯𞤫 𞤫 ,𞤊𞤪𞤢𞤲𞤧𞤭 ,𞤆𞤵𞤤𞤢𞥄𞤪 𞤶𞤢𞤲𞤺𞤢 𞤲𞤮 𞤫𞤢 𞤘𞤢𞤲𞤣𞤮 .𞤥𞤢𞥄𞤯𞤢 𞤯𞤫𞤲𞤯𞤢𞤤 𞤲𞤣𞤫𞤪 𞤫 𞤥𞤢𞥄𞤯𞤢 𞤢𞤨𞥆 𞤅𞤭𞤬𞤢𞥄",
    docsSection2Title: "𞤏𞤢𞤴𞤤𞤵𞤣𞤫 𞤫 𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫",
    docsSection2Body: "…𞤥𞤢𞥄𞤯𞤢 𞤢𞤨𞥆 𞤲𞤣𞤄𞥄𞤪𞤢 𞤢 𞤲𞤺𞤢𞤥 𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫 𞤚𞤢𞤩𞤤𞤮 𞤸𞤵𞥅𞤼𞤮𞤪 ,𞤥𞤢𞤸𞤵𞤣𞤫 𞤩𞤢𞥄𞤱𞤮 𞤲𞤣𞤫𞤪",
    docsSection3Title: "𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤒𞤢𞥄𞤪𞤵𞤺𞤮𞤤",
    docsSection3Body: "…𞤆𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤚𞤢𞤩𞤤𞤮 𞤌𞤯𥥆𞤵𞤼𞤵 .𞤥𞤢𞤧𞤭𞤲 𞤶𞤵𞥅𞤯𞤫 𞤫 𞤪𞤫𞤧𞤫𞥅 𞤲𞤮 𞤥𞤢𞥄𞤯𞤢 𞤨𞤮𞤪𞤮𞤶𞤫𞥅𞤶𞤭 𞤑𞤮",
    statusPageTitle: "𞤅𞤭𞤧𞤼𞤫𞤥 𞤐𞤮𞤲𞥆𞤣𞤫",
    statusPageSubtitle: "𞤶𞤮𞤲𞤭 𞤶𞤮𞤲𞤭 𞤫𞤢 𞤘𞤢𞤲𞤣𞤮 𞤺𞤮𞤤𞥆𞤫 𞤐𞤣𞤢𞥄𞤪𞤼𞤵𞤺𞤮𞤤",
    statusServer: "𞤲𞤫𞤼𞤱𞤮𞤪𞤳 𞤥𞤢𞤧𞤭𞤲",
    statusAI: "𞤫𞤢 𞤘𞤢𞤲𞤣𞤮 𞤚𞤢𞤩𞤤𞤮",
    statusFirebase: "𞤘𞤮𞤤𞥆𞤭𞤪𞤯𞤭 𞤔𞤢𞤴𞤫𞤪𞤦𞤫𞤧",
    statusOperational: "𞤒𞤫𞥅𞤲𞤯𞤭",
    statusDegraded: "𞤏𞤮𞤿𞤢𞥄𞤯𞤭",
    statusDown: "𞤓𞤲𞤢𞥄𞤯𞤭",
    statusChecking: "…𞤐𞤣𞤄𞥄𞤪𞤼𞤵𞤺𞤮𞤤",
    statusLastChecked: "𞤇𞤫𞤲𞥆𞤵𞤲𞤺𞤮𞤤 𞤐𞤣𞤄𞥄𞤪𞤼𞤵𞤺𞤮𞤤",
    statusModel: "𞤐𞤭𞥅𞤧𞤢𞥄𞤪𞤫",
    settings: "𞤚𞤫𞤩𞥆𞤫",
    logout: "𞤒𞤢𞤤𞤼𞤵",
    share: "𞤅𞤫𞤲𞤣𞤵",
    deploy: "𞤐𞤫𞤼𞤱𞤮𞤪𞤳 𞤫 𞤒𞤢𞥄𞤪𞤭𞤲𞤣𞤫",
    language: "𞤀𞤁𞤂𞤀𞤃",
    advanced: "𞤚𞤫𞤩𞥆𞤫 𞤒𞤫𞥅𞤧𞤮",
    errorNetwork: ".𞤳𞤢𞤯𞤭𞤼𞤵𞤲 𞤔𞤮𞤳𞥆𞤵 .𞤲𞤫𞤼𞤱𞤮𞤪𞤳 𞤊𞤭𞤣𞥆𞤭𞥅𞤲𞤣𞤫",
    errorGeneration: ".𞤥𞤢𞥄𞤯𞤢 𞤸𞤢𞥄𞤤𞤵 𞤏𞤢𞤴𞤤𞤵 .𞤃𞤢𞤸𞤵𞤣𞤫 𞤊𞤭𞤣𞥆𞤭𞥅𞤲𞤣𞤫",
    successGenerated: ".𞤖𞤮𞤤𞥆𞤭𞤪𞤣𞤫 𞤫 𞤑𞤮𞥅𞤣 𞤐𞤣𞤄𞥄𞤪 !𞤤𞤢𞥄𞤩𞤭 𞤲𞤮 𞤥𞤢𞤸𞤢𞥄𞤥𞤢 𞤀𞤨𞥆",
    suggestionDashboard: "𞤚𞤢𞤩𞤤𞤮",
    suggestionDashboardPrompt: "…𞤤𞤭𞤥𞤮𞥅𞤪𞤫 𞤲𞤺𞤢𞤥 𞤶𞤢𞤥𞤢𞥄𞤲𞤵 𞤼𞤢𞤩𞤤𞤮 𞤃𞤢𞤸𞤵𞤣𞤫",
    suggestionLearning: "𞤔𞤢𞤲𞤺𞤭𞤲𞤣𞤫",
    suggestionLearningPrompt: "…𞤳𞤫𞤧𞤫 𞤯𞤫𞤲𞤯𞤫 𞤶𞤢𞤲𞤺𞤭𞤲𞤣𞤫 𞤢𞤨𞥆 𞤃𞤮𞤷𞥆𞤭𞤲𞤣𞤫",
    suggestionBusiness: "𞤐𞤶𞤫𞥅𞤴𞤺𞤵",
    suggestionBusinessPrompt: "…𞤸𞤢𞤲𞥆𞤣𞤫𞥅𞤪𞤭 𞤲𞤶𞤫𞥅𞤴𞤺𞤵 𞤶𞤢𞥄𞤪𞤮𞥅𞤪𞤫 𞤃𞤢𞤸𞤵𞤣𞤫",
  },
  fr: {
    appName: "Gando",
    loginWithGoogle: "Continuer avec Google",
    heroTitle: "Créez des apps avec Gando AI.",
    heroSubtitle: "Le constructeur d'applications moderne pour l'Afrique. Décrivez votre vision dans votre langue maternelle.",
    loginEyebrow: "GANDO · POUR L'AFRIQUE",
    loginLine1: "Créez des apps",
    loginLine2: "dans votre",
    loginLine3: "langue maternelle.",
    beta: "Bêta Publique",
    errorAuth: "Erreur d'authentification. Veuillez vous reconnecter.",

    dashboardNav: "Tableau de bord",
    projectsNav: "Projets",
    assetsNav: "Ressources",
    searchPlaceholder: "Rechercher dans Gando…",

    myProjectsLabel: "Mes Projets",
    templatesNav: "Modèles",
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
    shareLabel: "Partager",
    sharePendingLabel: "En attente",
    shareLiveLabel: "Dans la galerie",
    shareConfirm: "Partager ce projet dans la galerie communautaire ? Un admin le vérifie avant publication, et d'autres utilisateurs peuvent le prévisualiser et le remixer.",
    communityTitle: "De la communauté",
    remixLabel: "Remixer",
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
    collectorLabel: "Collecteur",
    chatsLabel: "Discussions",
    recentsHeader: "RÉCENTS",
    settingsGeneralTab: "Général",
    settingsAccountTab: "Compte",
    settingsPrivacyTab: "Confidentialité",
    avatarLabel: "Avatar",
    avatarSubtitle: "Cliquez pour changer votre photo",
    fullNameLabel: "Nom complet",
    fullNameSubtitle: "Prénom et nom",
    gandoNamingQuery: "Comment Gando devrait-il vous appeler ?",
    gandoNamingSubtitle: "Utilisé dans votre salutation",
    workDescriptionQuery: "Qu'est-ce qui décrit le mieux votre travail ?",
    appearanceLabel: "Apparence",
    appearanceSubtitle: "Thème clair ou sombre",
    roleStudent: "Étudiant",
    roleEngineering: "Ingénierie",
    roleProductManagement: "Gestion de produit",
    roleDesign: "Design",
    roleDataScience: "Science des données",
    roleScience: "Science",
    roleBusiness: "Entreprise",
    roleMarketing: "Marketing",
    roleOperations: "Opérations",
    roleEducation: "Éducation",
    roleOther: "Autre",
    logOutActionLabel: "Se déconnecter",
    logOutActionSubtitle: "Se déconnecter de cet appareil",
    deleteAccountActionLabel: "Supprimer le compte",
    deleteAccountActionSubtitle: "Supprime définitivement votre compte, vos projets et vos discussions. Cette action est irréversible.",
    privacyBriefHeader: "Nous croyons en des pratiques de données transparentes. Vous contrôlez vos données ci-dessous.",
    improveModelsLabel: "Aidez à améliorer nos modèles",
    improveModelsSubtitle: "Autorisez l'utilisation de vos discussions pour entraîner Gando.",
    preciseLocationLabel: "Localisation précise",
    preciseLocationSubtitle: "Optionnel. La localisation approximative est déjà déduite.",
    exportDataLabel: "Exporter les données",
    exportDataSubtitle: "Télécharger vos projets et discussions (JSON)",
    signIn: "Se connecter",
    getStarted: "Commencer",
    twPhrases: [
      "Créez une marketplace avec support ADLaM et français…",
      "Construisez un site e-commerce pour artisans d'Afrique…",
      "Créez un portail d'actualités en script Pular…",
      "Concevez une app de streaming pour Bamako Sound…",
      "Lancez une plateforme d'apprentissage pour l'Afrique…",
    ],
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
    loginEyebrow: "GANDO · BUILT FOR AFRICA",
    loginLine1: "Build apps",
    loginLine2: "in your",
    loginLine3: "native tongue.",
    beta: "Public Beta",
    errorAuth: "Authentication failed. Please sign in again.",

    dashboardNav: "Dashboard",
    projectsNav: "Projects",
    assetsNav: "Assets",
    searchPlaceholder: "Search Gando…",

    myProjectsLabel: "My Projects",
    templatesNav: "Templates",
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
    shareLabel: "Share",
    sharePendingLabel: "Pending review",
    shareLiveLabel: "In gallery",
    shareConfirm: "Share this project to the community gallery? An admin reviews it before it goes public, and other users may preview and remix it.",
    communityTitle: "From the community",
    remixLabel: "Remix",
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
    collectorLabel: "Collector",
    chatsLabel: "Chats",
    recentsHeader: "RECENTS",
    settingsGeneralTab: "General",
    settingsAccountTab: "Account",
    settingsPrivacyTab: "Privacy",
    avatarLabel: "Avatar",
    avatarSubtitle: "Click to change your photo",
    fullNameLabel: "Full name",
    fullNameSubtitle: "First and last name",
    gandoNamingQuery: "What should Gando call you?",
    gandoNamingSubtitle: "Used in your greeting",
    workDescriptionQuery: "What best describes your work?",
    appearanceLabel: "Appearance",
    appearanceSubtitle: "Light or dark theme",
    roleStudent: "Student",
    roleEngineering: "Engineering",
    roleProductManagement: "Product management",
    roleDesign: "Design",
    roleDataScience: "Data science",
    roleScience: "Science",
    roleBusiness: "Business",
    roleMarketing: "Marketing",
    roleOperations: "Operations",
    roleEducation: "Education",
    roleOther: "Other",
    logOutActionLabel: "Log out",
    logOutActionSubtitle: "Sign out of this device",
    deleteAccountActionLabel: "Delete account",
    deleteAccountActionSubtitle: "Permanently deletes your account, projects and chats. This cannot be undone — unless you create a new account.",
    privacyBriefHeader: "We believe in transparent data practices. You control your data below.",
    improveModelsLabel: "Help improve our models",
    improveModelsSubtitle: "Allow your chats to be used to train and improve Gando. On by default.",
    preciseLocationLabel: "Precise location",
    preciseLocationSubtitle: "Optional. Coarse location (city) is already inferred from your connection.",
    exportDataLabel: "Export data",
    exportDataSubtitle: "Download your projects and chats (JSON)",
    signIn: "Sign in",
    getStarted: "Get started",
    twPhrases: [
      "Build a marketplace with ADLaM & French support…",
      "Create an e-commerce site for West African artisans…",
      "Build a news portal in Pular script…",
      "Design a music streaming app for Bamako Sound…",
      "Launch a learning platform for African students…",
    ],
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
