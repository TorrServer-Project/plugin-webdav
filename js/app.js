'use strict';

function t(key, def) {
    return (typeof i18n !== 'undefined' && i18n.t) ? i18n.t(key, def) : key;
}

function showToast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function loadStatus() {
    fetch('api/status')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            setText('dav-url', window.location.origin + d.dav_url);

            var status = document.getElementById('status-text');
            if (d.has_password) {
                status.textContent = t('plugin.webdav.password_set', 'Password is set');
                status.style.color = 'var(--silo-teal-bright)';
            } else {
                status.textContent = t('plugin.webdav.password_not_set', 'Password is not set. WebDAV is disabled.');
                status.style.color = 'var(--silo-danger)';
            }
        })
        .catch(function(e) { showToast(e.message, 'error'); });
}

function savePassword() {
    var input = document.getElementById('password-input');
    var password = input.value;
    if (!password) {
        showToast(t('plugin.webdav.enter_password', 'Enter a password'), 'error');
        return;
    }

    fetch('api/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
    })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.status === 'ok') {
                showToast(t('plugin.webdav.saved', 'Saved'), 'success');
                input.value = '';
                loadStatus();
            } else {
                showToast(d.error || 'error', 'error');
            }
        })
        .catch(function(e) { showToast(e.message, 'error'); });
}

function removePassword() {
    fetch('api/password/remove', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.status === 'ok') {
                showToast(t('plugin.webdav.removed', 'Removed'), 'success');
                loadStatus();
            } else {
                showToast(d.error || 'error', 'error');
            }
        })
        .catch(function(e) { showToast(e.message, 'error'); });
}

document.getElementById('btn-save').addEventListener('click', savePassword);
document.getElementById('btn-remove').addEventListener('click', removePassword);
document.getElementById('password-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') savePassword();
});

if (typeof i18n !== 'undefined' && i18n.apply) i18n.apply();
loadStatus();