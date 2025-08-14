// --- START OF FILE renderer.js ---

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elementlerini Seç
    const appList = document.getElementById('app-list');
    const showModalBtn = document.getElementById('show-modal-btn');
    const modal = document.getElementById('app-modal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const appForm = document.getElementById('app-form');
    const modalTitle = document.getElementById('modal-title');
    const appIdInput = document.getElementById('app-id');
    const appNameInput = document.getElementById('app-name');
    const appUrlInput = document.getElementById('app-url');
    const customIconPathInput = document.getElementById('custom-icon-path');
    const iconGroupContainer = document.getElementById('icon-group-container');
    const iconPreview = document.getElementById('icon-preview');
    const iconInfo = document.getElementById('icon-info');
    const chooseIconBtn = document.getElementById('choose-icon-btn');
    const formSubmitBtn = document.getElementById('form-submit-btn');
    const statusMessage = document.getElementById('status-message');

    let allApps = [];
    let currentMode = 'create';
    let iconChangedInEdit = false;

    // Güvenlik için HTML'i escape etme
    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str || ''));
        return p.innerHTML;
    };

    // Uygulama listesini main sürecinden getirme ve ekrana render etme
    const populateAppList = async () => {
        appList.innerHTML = '<p class="status-text">Yükleniyor...</p>';
        try {
            allApps = await window.electronAPI.getApps();
            renderAppList();
        } catch (error) {
            appList.innerHTML = `<p class="status-text error">Uygulamalar yüklenirken bir hata oluştu: ${error.message}</p>`;
        }
    };

    const renderAppList = () => {
        appList.innerHTML = '';
        if (allApps.length === 0) {
            appList.innerHTML = '<p class="status-text">Henüz hiç kapsül oluşturmadınız.</p>';
            return;
        }
        allApps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.dataset.appId = app.id;
            card.innerHTML = `
                <img src="${app.iconDataUrl || 'https://via.placeholder.com/64/3a3a3c/8e8e93?text=?'}" alt="${escapeHTML(app.appName)}" class="app-icon">
                <div class="app-info">
                    <h3>${escapeHTML(app.appName)}</h3>
                    <p>${escapeHTML(app.appUrl)}</p>
                </div>
                <div class="app-actions">
                    <button class="btn-icon edit-btn" title="Düzenle"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon delete-btn" title="Sil"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            appList.appendChild(card);
        });
    };
    
    // Modal kapatıldığında formu tamamen sıfırlayan fonksiyon
    const resetModal = () => {
        appForm.reset();
        customIconPathInput.value = '';
        statusMessage.textContent = '';
        statusMessage.className = '';
        formSubmitBtn.disabled = false;
        iconPreview.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
        iconChangedInEdit = false;
    };

    // Modalın görünürlüğünü kontrol et
    const toggleModal = (visible) => {
        if (visible) {
            modal.classList.add('visible');
        } else {
            modal.classList.remove('visible');
            resetModal();
        }
    };
    
    // Yeni uygulama oluşturma modunda modalı aç
    const openModalForCreate = () => {
        currentMode = 'create';
        resetModal();
        modalTitle.textContent = 'Yeni Kapsül Oluştur';
        formSubmitBtn.textContent = 'Oluştur';
        iconGroupContainer.style.display = 'none'; // İkon grubunu GİZLE
        toggleModal(true);
        appNameInput.focus();
    };

    // Düzenleme modunda modalı aç
    const openModalForEdit = (appId) => {
        currentMode = 'edit';
        resetModal(); // Önce formu temizle
        const app = allApps.find(a => a.id === appId);
        if (!app) return;

        modalTitle.textContent = 'Kapsülü Düzenle';
        formSubmitBtn.textContent = 'Kaydet';
        iconGroupContainer.style.display = 'block'; // İkon grubunu GÖSTER

        appIdInput.value = app.id;
        appNameInput.value = app.appName;
        appUrlInput.value = app.appUrl;
        customIconPathInput.value = app.customIconPath || '';
        
        // Karttaki ikonun aynısını önizlemeye koy
        iconPreview.src = app.iconDataUrl || 'https://via.placeholder.com/48/3a3a3c/8e8e93?text=?';
        iconInfo.textContent = app.customIconPath ? pathBasename(app.customIconPath) : 'Mevcut ikonu koru.';
        
        toggleModal(true);
        appNameInput.focus();
    };

    // Olay Dinleyicileri
    showModalBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', () => toggleModal(false));
    modal.addEventListener('click', (e) => { if (e.target === modal) toggleModal(false); });

    chooseIconBtn.addEventListener('click', async () => {
        const filePath = await window.electronAPI.openFileDialog();
        if (filePath) {
            iconChangedInEdit = true;
            customIconPathInput.value = filePath;
            iconInfo.textContent = pathBasename(filePath);
            iconPreview.src = `file://${filePath}`;
        }
    });

    appForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formSubmitBtn.disabled = true;
        statusMessage.textContent = 'İşleniyor...';
        statusMessage.className = '';

        try {
            let result;
            if (currentMode === 'create') {
                const data = { appName: appNameInput.value.trim(), appUrl: appUrlInput.value.trim() };
                result = await window.electronAPI.createApp(data);

            } else {
                let iconPathToSend;
                if (iconChangedInEdit) {
                    iconPathToSend = customIconPathInput.value || null;
                } else {
                    iconPathToSend = undefined; 
                }
                const data = {
                    appId: appIdInput.value,
                    appName: appNameInput.value.trim(),
                    appUrl: appUrlInput.value.trim(),
                    customIconPath: iconPathToSend,
                };
                result = await window.electronAPI.editApp(data);
            }

            if (result.success) {
                toggleModal(false);
                await populateAppList();
            } else {
                throw new Error(result.error || 'Bilinmeyen bir hata oluştu.');
            }
        } catch (error) {
            statusMessage.textContent = `Hata: ${error.message}`;
            statusMessage.className = 'error';
        } finally {
            formSubmitBtn.disabled = false;
        }
    });

    appList.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const card = target.closest('.app-card');
        const appId = card.dataset.appId;

        if (target.classList.contains('edit-btn')) {
            openModalForEdit(appId);
        } else if (target.classList.contains('delete-btn')) {
            const appName = card.querySelector('h3').textContent;
            if (confirm(`'${appName}' kapsülünü silmek istediğinizden emin misiniz?`)) {
                window.electronAPI.deleteApp(appId).then(result => {
                    if (result.success) populateAppList();
                    else alert(`Hata: ${result.error}`);
                });
            }
        }
    });
    
    const pathBasename = (p) => p ? p.split(/[\\/]/).pop() : '';

    // İlk yüklemede uygulama listesini doldur
    populateAppList();
});

// =========================================================================
// YENİ: Otomatik güncelleme loglarını dinle ve geliştirici konsoluna yazdır
// =========================================================================
window.electronAPI.onUpdateLog((_event, message) => {
    // Mesajları daha okunaklı yapmak için stilize edelim
    console.log('%c[Updater]', 'color: cyan; font-weight: bold;', message);
});