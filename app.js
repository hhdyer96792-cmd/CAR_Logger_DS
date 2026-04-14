// ==================== 1. SUPABASE ====================
const SUPABASE_URL = 'https://efagdgsmnecqtyuaogzi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L3cgEGpUECYyCz3xkSd1uw_DWO9M9d6';

// Проверка загрузки библиотеки
if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded! Check script tag in HTML.');
}

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase client created:', !!sb);


// ==================== 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentUser = null;
let operations = [];
let parts = [];
let fuelLog = [];
let tireLog = [];
let serviceRecords = [];
let settings = {
    currentMileage: 0,
    currentMotohours: 0,
    avgDailyMileage: 45,
    avgDailyMotohours: 1.8,
    telegramToken: '',
    telegramChatId: '',
    notificationMethod: 'telegram'
};
// ==================== 3. DOM ЭЛЕМЕНТЫ ====================
// --- Панели ---
const authPanel = document.getElementById('auth-panel');
const dataPanel = document.getElementById('data-panel');
const spreadsheetPanel = document.getElementById('spreadsheet-panel'); // если осталось от старой версии, можно оставить или убрать

// --- Аутентификация ---
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authStatus = document.getElementById('auth-status');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');

// --- Вкладки ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// --- Виджеты ТО ---
const displayMileage = document.getElementById('display-mileage');
const displayMotohours = document.getElementById('display-motohours');
const displayAvgMileage = document.getElementById('display-avg-mileage');
const nextServiceName = document.getElementById('next-service-name');
const progressBar = document.getElementById('progress-bar');
const progressDetails = document.getElementById('progress-details');

// --- Кнопки действий (ТО) ---
const addOperationBtn = document.getElementById('add-operation-btn');
const recalculateBtn = document.getElementById('recalculate-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

// --- Таблицы ---
const tableBody = document.getElementById('table-body');           // ТО
const partsBody = document.getElementById('parts-body');           // Запчасти
const fuelBody = document.getElementById('fuel-body');             // Топливо
const tiresBody = document.getElementById('tires-body');           // Шины
const historyBody = document.getElementById('history-body');       // История

// --- Топливо ---
const addFuelBtn = document.getElementById('add-fuel-btn');
const voiceFuelBtn = document.getElementById('voice-fuel-btn');

// --- Шины ---
const addTireBtn = document.getElementById('add-tire-btn');
const tireRecommendation = document.getElementById('tire-recommendation');

// --- Запчасти ---
const addPartBtn = document.getElementById('add-part-btn');

// --- Настройки ---
const setMileage = document.getElementById('set-mileage');
const setMotohours = document.getElementById('set-motohours');
const setAvgMileage = document.getElementById('set-avg-mileage');
const setAvgMotohours = document.getElementById('set-avg-motohours');
const telegramToken = document.getElementById('telegram-token');
const telegramChatId = document.getElementById('telegram-chatid');
const notificationMethod = document.getElementById('notification-method');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsResult = document.getElementById('settings-result');
const subscribePushBtn = document.getElementById('subscribe-push-btn');
const pushStatus = document.getElementById('push-status');
const openPhotoFolderBtn = document.getElementById('open-photo-folder-btn');
const shareTableBtn = document.getElementById('share-table-btn');

// --- Тема и синхронизация ---
const themeToggle = document.getElementById('theme-toggle');
const syncIndicator = document.getElementById('sync-indicator');

// --- Статистика ---
const oilChart = document.getElementById('oilChart');
const costsChart = document.getElementById('costsChart');
const fuelChart = document.getElementById('fuelChart');
// ==================== 4. АВТОРИЗАЦИЯ ====================
async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    authPanel.style.display = 'block';
    dataPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
}

// Проверка сессии при загрузке
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        authPanel.style.display = 'none';
        dataPanel.style.display = 'block';
        logoutBtn.style.display = 'inline-block';
        await loadAllData();
    } else {
        authPanel.style.display = 'block';
    }
}
// ==================== 5. ЗАГРУЗКА ДАННЫХ ====================
async function loadAllData() {
    if (!currentUser) return;
    const userId = currentUser.id;

    // Привязать бесхозные операции к текущему пользователю
    await supabase.from('operations').update({ user_id: userId }).is('user_id', null);

    // operations
    const { data: ops } = await supabase.from('operations').select('*').eq('user_id', userId);
    operations = ops || [];

    // parts
    const { data: pts } = await supabase.from('parts').select('*').eq('user_id', userId);
    parts = pts || [];

    // fuel_log
    const { data: fuel } = await supabase.from('fuel_log').select('*').eq('user_id', userId).order('date', { ascending: false });
    fuelLog = fuel || [];

    // tires
    const { data: tires } = await supabase.from('tires').select('*').eq('user_id', userId).order('date', { ascending: false });
    tireLog = tires || [];

    // settings (создать, если нет)
    let { data: sets } = await supabase.from('settings').select('*').eq('user_id', userId).single();
    if (!sets) {
        const { data: newSet } = await supabase.from('settings').insert([{ user_id: userId }]).select().single();
        sets = newSet;
    }
    if (sets) {
        settings.currentMileage = sets.current_mileage || 0;
        settings.currentMotohours = sets.current_motohours || 0;
        settings.avgDailyMileage = sets.avg_daily_mileage || 45;
        settings.avgDailyMotohours = sets.avg_daily_motohours || 1.8;
        settings.telegramToken = sets.telegram_token || '';
        settings.telegramChatId = sets.telegram_chat_id || '';
        settings.notificationMethod = sets.notification_method || 'telegram';
    }

    // service_records (для истории)
    const { data: recs } = await supabase.from('service_records')
        .select('*, operations(name)')
        .eq('user_id', userId)
        .order('date', { ascending: false });
    serviceRecords = recs || [];

    renderAll();
}
// ==================== 6. РАСЧЁТ ПЛАНОВ ====================
function getOilMotohoursInterval(op, avgSpeed) {
    if (op.name.includes('Масло') && op.category.includes('ДВС')) {
        return avgSpeed < 20 ? 200 : 250;
    }
    return op.interval_motohours;
}

function calculatePlan(op) {
    const today = new Date(); today.setHours(0,0,0,0);
    let recDate = op.last_date ? new Date(op.last_date) : new Date(today);
    recDate.setMonth(recDate.getMonth() + (op.interval_months || 0));
    const recMileage = (op.last_mileage || 0) + (op.interval_km || 0);
    const avgSpeed = settings.avgDailyMileage / settings.avgDailyMotohours;
    const motoInterval = getOilMotohoursInterval(op, avgSpeed);
    let recMotohours = motoInterval ? (op.last_motohours || 0) + motoInterval : null;

    let dateByMileage = new Date(8640000000000000);
    if (op.interval_km && recMileage > settings.currentMileage && settings.avgDailyMileage > 0) {
        const days = Math.ceil((recMileage - settings.currentMileage) / settings.avgDailyMileage);
        dateByMileage = new Date(today); dateByMileage.setDate(today.getDate() + days);
    }
    let dateByMoto = new Date(8640000000000000);
    if (recMotohours && recMotohours > settings.currentMotohours && settings.avgDailyMotohours > 0) {
        const days = Math.ceil((recMotohours - settings.currentMotohours) / settings.avgDailyMotohours);
        dateByMoto = new Date(today); dateByMoto.setDate(today.getDate() + days);
    }
    const planDate = new Date(Math.min(recDate, dateByMileage, dateByMoto));
    const daysLeft = Math.ceil((planDate - today) / 86400000);
    return {
        recDate: recDate.toISOString().split('T')[0],
        recMileage,
        recMotohours: recMotohours || '',
        planDate: planDate.toISOString().split('T')[0],
        planMileage: recMileage,
        daysLeft
    };
}
// ==================== 7. СОХРАНЕНИЕ ТО ====================
async function addServiceRecord(opId, date, mileage, motohours, partsCost, workCost, isDIY, notes, photoFile) {
    // Если офлайн – сохраняем в очередь (без фото)
    if (!navigator.onLine) {
        addPendingAction({
            type: 'ADD_SERVICE_RECORD',
            operationId: opId,
            date,
            mileage,
            motohours,
            partsCost,
            workCost,
            isDIY,
            notes
        });
        // Оптимистичное обновление UI
        const op = operations.find(o => o.id == opId);
        if (op) {
            op.last_date = date;
            op.last_mileage = parseInt(mileage);
            op.last_motohours = parseFloat(motohours) || 0;
        }
        renderTOTable();
        updateNextServiceWidget();
        updateSyncIndicator();
        return;
    }

    // Онлайн – загружаем фото и сохраняем в Supabase
    let photoUrl = '';
    if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('photos').upload(fileName, photoFile);
        if (!error) {
            const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(fileName);
            photoUrl = publicUrl.publicUrl;
        }
    }

    const record = {
        operation_id: opId,
        date,
        mileage: parseInt(mileage),
        motohours: parseFloat(motohours) || null,
        parts_cost: parseFloat(partsCost) || 0,
        work_cost: parseFloat(workCost) || 0,
        is_diy: isDIY,
        notes,
        photo_url: photoUrl,
        user_id: currentUser.id
    };
    await supabase.from('service_records').insert(record);

    await supabase.from('operations')
        .update({
            last_date: date,
            last_mileage: parseInt(mileage),
            last_motohours: parseFloat(motohours) || 0
        })
        .eq('id', opId);

    await loadAllData();
    updateSyncIndicator();
}

// Сохранение настроек
async function saveSettings() {
    const updates = {
        current_mileage: settings.currentMileage,
        current_motohours: settings.currentMotohours,
        avg_daily_mileage: settings.avgDailyMileage,
        avg_daily_motohours: settings.avgDailyMotohours,
        telegram_token: settings.telegramToken,
        telegram_chat_id: settings.telegramChatId,
        notification_method: settings.notificationMethod
    };
    await supabase.from('settings').update(updates).eq('user_id', currentUser.id);
    alert('✅ Настройки сохранены');
}
// ==================== ОФЛАЙН-ОЧЕРЕДЬ ====================
let pendingActions = [];
const PENDING_KEY = 'vesta_pending_actions';

// Загрузить очередь из localStorage
function loadPendingActions() {
    const stored = localStorage.getItem(PENDING_KEY);
    if (stored) {
        try {
            pendingActions = JSON.parse(stored);
        } catch (e) {
            pendingActions = [];
        }
    }
}

// Сохранить очередь
function savePendingActions() {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendingActions));
}

// Добавить действие в очередь
function addPendingAction(action) {
    pendingActions.push(action);
    savePendingActions();
    updateSyncIndicator();
}

// Выполнить все отложенные действия (вызывается при появлении сети)
async function syncPendingActions() {
    if (!navigator.onLine || !currentUser || pendingActions.length === 0) return;

    syncIndicator.className = 'syncing';
    syncIndicator.title = 'Синхронизация...';

    const actionsToProcess = [...pendingActions];
    pendingActions = [];
    savePendingActions();

    for (const action of actionsToProcess) {
        try {
            switch (action.type) {
                case 'ADD_SERVICE_RECORD':
                    await addServiceRecord(
                        action.operationId,
                        action.date,
                        action.mileage,
                        action.motohours,
                        action.partsCost,
                        action.workCost,
                        action.isDIY,
                        action.notes,
                        null // фото в офлайне не сохраняем (можно доработать)
                    );
                    break;
                case 'ADD_FUEL':
                    await supabase.from('fuel_log').insert([action.data]);
                    break;
                case 'ADD_TIRE':
                    await supabase.from('tires').insert([action.data]);
                    break;
                case 'UPDATE_SETTINGS':
                    await supabase.from('settings').update(action.data).eq('user_id', currentUser.id);
                    break;
                // другие типы действий...
            }
        } catch (e) {
            console.warn('Ошибка синхронизации действия:', action, e);
            // Возвращаем в очередь, если не получилось
            pendingActions.push(action);
        }
    }

    savePendingActions();
    updateSyncIndicator();

    if (pendingActions.length === 0) {
        await loadAllData(); // обновить данные после успешной синхронизации
    }
}

// Обновить индикатор синхронизации
function updateSyncIndicator() {
    if (!navigator.onLine) {
        syncIndicator.className = 'error';
        syncIndicator.title = 'Нет соединения';
    } else if (pendingActions.length > 0) {
        syncIndicator.className = 'syncing';
        syncIndicator.title = `Ожидают синхронизации: ${pendingActions.length}`;
    } else {
        syncIndicator.className = 'synced';
        syncIndicator.title = 'Синхронизировано';
    }
}

// Подписка на события сети
function initOfflineSync() {
    loadPendingActions();
    updateSyncIndicator();

    window.addEventListener('online', () => {
        updateSyncIndicator();
        syncPendingActions();
    });

    window.addEventListener('offline', () => {
        updateSyncIndicator();
    });
}


// ==================== 8. ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ====================
function initEventListeners() {
    // ---------- АВТОРИЗАЦИЯ ----------
    loginBtn.addEventListener('click', async () => {
        try {
            await signIn(loginEmail.value.trim(), loginPassword.value);
            authStatus.textContent = '';
        } catch (e) {
            authStatus.textContent = '❌ ' + e.message;
        }
    });

    registerBtn.addEventListener('click', async () => {
        try {
            await signUp(loginEmail.value.trim(), loginPassword.value);
            authStatus.textContent = '✅ Проверьте почту для подтверждения';
        } catch (e) {
            authStatus.textContent = '❌ ' + e.message;
        }
    });

    logoutBtn.addEventListener('click', signOut);

    // ---------- ТЕМА ----------
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    });

    // ---------- ВКЛАДКИ ----------
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            if (targetTab === 'history') renderHistoryTable();
            if (targetTab === 'stats') renderStats();
        });
    });

    // ---------- ОСНОВНЫЕ ДЕЙСТВИЯ (ТО) ----------
    addOperationBtn.addEventListener('click', () => openOperationForm());
    recalculateBtn.addEventListener('click', () => {
        renderTOTable();
        updateNextServiceWidget();
    });
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importData);

    // ---------- ЗАПЧАСТИ ----------
    addPartBtn.addEventListener('click', () => openPartForm());

    // ---------- ТОПЛИВО (с поддержкой офлайна) ----------
    addFuelBtn.addEventListener('click', () => openFuelModal({}));
    voiceFuelBtn.addEventListener('click', startVoiceInput);

    // ---------- ШИНЫ (с поддержкой офлайна) ----------
    addTireBtn.addEventListener('click', () => {
        const type = prompt('Введите тип резины (лето/зима):');
        if (!type) return;
        const date = new Date().toISOString().split('T')[0];
        const mileage = settings.currentMileage;
        const record = { date, type, mileage, user_id: currentUser.id };

        if (navigator.onLine) {
            supabase.from('tires').insert([record]).then(() => loadAllData());
        } else {
            addPendingAction({ type: 'ADD_TIRE', data: record });
            // Оптимистичное обновление UI
            tireLog.push(record);
            renderTiresTable();
            updateSyncIndicator();
        }
    });

    // ---------- НАСТРОЙКИ (с поддержкой офлайна) ----------
    saveSettingsBtn.addEventListener('click', async () => {
        // Обновить локальные настройки
        settings.currentMileage = parseInt(setMileage.value) || 0;
        settings.currentMotohours = parseInt(setMotohours.value) || 0;
        settings.avgDailyMileage = parseFloat(setAvgMileage.value) || 45;
        settings.avgDailyMotohours = parseFloat(setAvgMotohours.value) || 1.8;
        settings.telegramToken = telegramToken.value;
        settings.telegramChatId = telegramChatId.value;
        settings.notificationMethod = notificationMethod.value;

        const updates = {
            current_mileage: settings.currentMileage,
            current_motohours: settings.currentMotohours,
            avg_daily_mileage: settings.avgDailyMileage,
            avg_daily_motohours: settings.avgDailyMotohours,
            telegram_token: settings.telegramToken,
            telegram_chat_id: settings.telegramChatId,
            notification_method: settings.notificationMethod
        };

        if (navigator.onLine) {
            await supabase.from('settings').update(updates).eq('user_id', currentUser.id);
            settingsResult.textContent = '✅ Сохранено';
        } else {
            addPendingAction({ type: 'UPDATE_SETTINGS', data: updates });
            settingsResult.textContent = '⏳ Сохранено локально. Синхронизируется при подключении.';
            updateSyncIndicator();
        }
    });

    subscribePushBtn.addEventListener('click', subscribeToPush);

    openPhotoFolderBtn.addEventListener('click', () => {
        window.open(`${SUPABASE_URL}/storage/v1/bucket/photos`, '_blank');
    });

    shareTableBtn.addEventListener('click', () => {
        prompt('Скопируйте ссылку на приложение:', window.location.href);
    });

    // ---------- ИНИЦИАЛИЗАЦИЯ ОФЛАЙН-СИНХРОНИЗАЦИИ ----------
    initOfflineSync();
}

// ==================== 9. ЗАПУСК ====================
checkSession();
initEventListeners();
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}
