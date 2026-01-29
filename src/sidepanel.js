// @ts-nocheck
/* global Quill */

// ========================================
// DOM ELEMENT REFERENCES
// ========================================

// Editor Constants
const plainTxt = document.getElementById("plainTextEditor");
const richTxt = document.getElementById("richTextEditor");
const toolBar = document.getElementById("toolbar");
const plainTextArea = document.getElementById("plainTextArea");
const noteType = document.getElementById("noteType");
const noteTitle = document.getElementById("noteTitle");
const savedNotesBtn = document.getElementById("savedNotesBtn");
const savedNotesModal = document.getElementById("savedNotesModal");
const closeSavedNotesBtn = document.getElementById("closeSavedNotesBtn");
const newNoteBtn = document.getElementById("newNoteBtn");
const menuBtn = document.getElementById("menuBtn");
const menuDialog = document.getElementById("menuDialog");
const menuExport = document.getElementById("menuExport");
const menuImport = document.getElementById("menuImport");
const notesList = document.getElementById("notesList");
const darkModeBtn = document.getElementById("darkModeBtn");

// Dialog elements
const deleteDialog = document.getElementById("deleteDialog");
const deleteCancel = document.getElementById("deleteCancel");
const deleteConfirm = document.getElementById("deleteConfirm");
const noteTypeDialog = document.getElementById("noteTypeDialog");
const createPlainNote = document.getElementById("createPlainNote");
const createRichNote = document.getElementById("createRichNote");
const renameDialog = document.getElementById("renameDialog");
const renameInput = document.getElementById("renameInput");
const renameCancel = document.getElementById("renameCancel");
const renameConfirm = document.getElementById("renameConfirm");
const downloadDialog = document.getElementById("downloadDialog");
const downloadAsTxt = document.getElementById("downloadAsTxt");
const downloadAsDoc = document.getElementById("downloadAsDoc");
const downloadCancel = document.getElementById("downloadCancel");

let pendingDeleteNoteId = null;
let pendingRenameNoteId = null;
let pendingDownloadNoteId = null;



// ToolBar Constants
const alignLeftBtn = document.getElementById("alignLeftBtn");
const alignCenterBtn = document.getElementById("alignCenterBtn");
const alignRightBtn = document.getElementById("alignRightBtn");
const decreaseFontBtn = document.getElementById("decreaseFontBtn");
const increaseFontBtn = document.getElementById("increaseFontBtn");
const fontSizeInput = document.getElementById("fontSizeInput");
const fontSizeDropdown = document.getElementById("fontSizeDropdown");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const strikeBtn = document.getElementById("strikeBtn");
const ulBtn = document.getElementById("ulBtn");
const olBtn = document.getElementById("olBtn");
const clearBtn = document.getElementById("clearBtn");
const fontSelect = document.getElementById("fontSelect");


// EDITOR MODE HELPERS
// ====================

function setEditorMode(mode) {
    const isRich = mode === 'rich';
    plainTxt.style.display = isRich ? 'none' : 'block';
    richTxt.style.display = isRich ? 'block' : 'none';
    toolBar.style.display = isRich ? 'block' : 'none';
    noteType.textContent = isRich ? 'Richtext' : 'Plaintext';
}

function updateNoteTitle(title) {
    noteTitle.textContent = title || 'Untitled';
}

setEditorMode('plain');

window.showPlainEditor = () => setEditorMode('plain');
window.showRichEditor = () => setEditorMode('rich');

// NOTES STORAGE SYSTEM
// ========================================

let notes = [];
let activeNoteId = null;
let isFirstRunDraft = false; 

const STORAGE_KEY = 'plaintext_notes';
const ACTIVE_NOTE_KEY = 'active_note_id';

// Load notes from storage
async function loadNotes() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            notes = result[STORAGE_KEY] || [];
            resolve(notes);
        });
    });
}

// Save notes to storage
async function saveNotes() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: notes }, resolve);
    });
}

// Save active note ID
async function saveActiveNoteId(noteId) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [ACTIVE_NOTE_KEY]: noteId }, resolve);
    });
}

// Load active note ID
async function loadActiveNoteId() {
    return new Promise((resolve) => {
        chrome.storage.local.get([ACTIVE_NOTE_KEY], (result) => {
            resolve(result[ACTIVE_NOTE_KEY] || null);
        });
    });
}

// Save individual note
async function saveNote(noteId, content) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.content = content;
        note.lastModified = Date.now();
        await saveNotes();
    }
}

function renderNotesList() {
    notesList.innerHTML = '';

    if (notes.length === 0) {
        const template = document.getElementById('emptyStateTemplate');
        const clone = template.content.cloneNode(true);
        notesList.appendChild(clone);
        return;
    }

    notes.forEach(note => {
        const template = document.getElementById('noteItemTemplate');
        const clone = template.content.cloneNode(true);
        
        const item = clone.querySelector('.note-item');
        const isActive = activeNoteId === note.id;
        item.style.borderColor = isActive ? '#1a73e8' : '#e0e0e0';
        
        const date = new Date(note.lastModified);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const typeLabel = (note.type || 'plain') === 'rich' ? 'Rich' : 'Plain';

        clone.querySelector('.note-item-title').textContent = note.title;
        clone.querySelector('.note-item-type').textContent = typeLabel;
        clone.querySelector('.note-item-date').textContent = dateStr;
        
        // Load note on info click
        const infoDiv = clone.querySelector('.note-item-info');
        infoDiv.addEventListener('click', async () => {
            await loadNoteIntoEditor(note.id);
            renderNotesList(); 
        });
        infoDiv.style.cursor = 'pointer';
        
        // Delete button
        const deleteBtn = clone.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(note.id);
        });
        
        // Rename button
        const renameBtn = clone.querySelector('.rename-btn');
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameNote(note.id);
        });
        
        // Download button
        const downloadBtn = clone.querySelector('.download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if ((note.type || 'plain') === 'rich') {
                showDownloadDialog(note.id);
            } else {
                downloadNote(note.id, 'txt');
            }
        });
        
        notesList.appendChild(clone);
    });
}

// Create an unsaved draft note
async function createDraftNote() {
    const draftNote = {
        id: `draft-${Date.now()}`,
        title: 'Untitled',
        content: '',
        type: 'plain',
        lastModified: Date.now()
    };
    notes.push(draftNote);
    activeNoteId = draftNote.id;
    isFirstRunDraft = true;
    plainTextArea.value = '';
    setEditorMode('plain');
    updateNoteTitle(draftNote.title);
    await saveActiveNoteId(activeNoteId);
    return draftNote;
}

async function deleteNote(noteId) {
    showDeleteConfirmation(noteId);
}

async function renameNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    showRenameDialog(noteId, note.title);
}

function showDownloadDialog(noteId) {
    pendingDownloadNoteId = noteId;
    downloadDialog.style.display = 'flex';
}

function closeDownloadDialog() {
    downloadDialog.style.display = 'none';
    pendingDownloadNoteId = null;
}

function extractNoteText(note) {
    if (!note) return '';
    if ((note.type || 'plain') !== 'rich') return note.content || '';

    try {
        const delta = JSON.parse(note.content || '{}');
        return (delta.ops || []).map(op => {
            if (typeof op.insert === 'string') {
                return op.insert;
            }
            return '';
        }).join('');
    } catch (e) {
        return note.content || '';
    }
}

function deltaToHtml(delta) {
    try {
        const ops = delta.ops || [];
        let html = '';
        
        for (const op of ops) {
            if (typeof op.insert !== 'string') continue;
            
            let text = op.insert;
            const attrs = op.attributes || {};
            
            // Handle newlines
            if (text === '\n') {
                html += '<br>';
                continue;
            }
            
            // Escape HTML entities
            text = text.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/\n/g, '<br>');
            
            let styles = [];
            if (attrs.font) styles.push(`font-family: '${attrs.font}'`);
            if (attrs.size) {
                const sizeValue = String(attrs.size).replace('px', '');
                styles.push(`font-size: ${sizeValue}px`);
            }
            if (attrs.bold) styles.push('font-weight: bold');
            if (attrs.italic) styles.push('font-style: italic');
            if (attrs.underline) styles.push('text-decoration: underline');
            if (attrs.strike) styles.push('text-decoration: line-through');
            
            if (styles.length > 0) {
                text = `<span style="${styles.join('; ')}">${text}</span>`;
            }
            
            html += text;
        }
        
        return html;
    } catch (e) {
        return '';
    }
}

function downloadNote(noteId, format = 'txt') {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const isDoc = format === 'doc';
    const filename = `${note.title || 'Untitled'}.${isDoc ? 'doc' : 'txt'}`;

    let blob;
    if (isDoc && (note.type || 'plain') === 'rich') {
        try {
            const delta = JSON.parse(note.content || '{}');
            const htmlContent = deltaToHtml(delta);
            const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="Generator" content="NotePad Extension">
<style>
body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; margin: 20px; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
            blob = new Blob([html], { type: 'application/msword' });
        } catch (e) {
            const textContent = extractNoteText(note);
            const htmlContent = (textContent || '').replace(/\n/g, '<br>');
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlContent}</body></html>`;
            blob = new Blob([html], { type: 'application/msword' });
        }
    } else {
        const textContent = extractNoteText(note);
        blob = new Blob([textContent || ''], { type: 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showDeleteConfirmation(noteId) {
    pendingDeleteNoteId = noteId;
    deleteDialog.style.display = 'flex';
}

function showRenameDialog(noteId, currentTitle) {
    pendingRenameNoteId = noteId;
    renameInput.value = currentTitle;
    renameDialog.style.display = 'flex';
    setTimeout(() => {
        renameInput.focus();
        renameInput.select();
    }, 100);
}

// Delete dialog handlers
deleteCancel.addEventListener('click', () => {
    deleteDialog.style.display = 'none';
    pendingDeleteNoteId = null;
});

deleteConfirm.addEventListener('click', async () => {
    if (pendingDeleteNoteId) {
        notes = notes.filter(n => n.id !== pendingDeleteNoteId);
        await saveNotes();
        
        if (activeNoteId === pendingDeleteNoteId) {
            activeNoteId = null;
            plainTextArea.value = '';
            updateNoteTitle('Untitled');
            await saveActiveNoteId(null);
            
            if (notes.length > 0) {
                const mostRecent = notes.reduce((a, b) => 
                    a.lastModified > b.lastModified ? a : b
                );
                await loadNoteIntoEditor(mostRecent.id);
            } else {
                await createDraftNote();
            }
        }
        
        renderNotesList();
        deleteDialog.style.display = 'none';
        pendingDeleteNoteId = null;
    }
});

deleteDialog.addEventListener('click', (e) => {
    if (e.target === deleteDialog) {
        deleteDialog.style.display = 'none';
        pendingDeleteNoteId = null;
    }
});

// Rename dialog handlers
renameCancel.addEventListener('click', () => {
    renameDialog.style.display = 'none';
    pendingRenameNoteId = null;
});

renameConfirm.addEventListener('click', async () => {
    if (pendingRenameNoteId) {
        const newTitle = renameInput.value.trim();
        if (newTitle) {
            const note = notes.find(n => n.id === pendingRenameNoteId);
            if (note) {
                note.title = newTitle;
                await saveNotes();
                renderNotesList();

                if (activeNoteId === pendingRenameNoteId) {
                    updateNoteTitle(newTitle);
                }
            }
        }
        renameDialog.style.display = 'none';
        pendingRenameNoteId = null;
    }
});

renameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        renameConfirm.click();
    }
});

renameDialog.addEventListener('click', (e) => {
    if (e.target === renameDialog) {
        renameDialog.style.display = 'none';
        pendingRenameNoteId = null;
    }
});

// Download dialog handlers
downloadAsTxt.addEventListener('click', () => {
    if (pendingDownloadNoteId) {
        downloadNote(pendingDownloadNoteId, 'txt');
    }
    closeDownloadDialog();
});

downloadAsDoc.addEventListener('click', () => {
    if (pendingDownloadNoteId) {
        downloadNote(pendingDownloadNoteId, 'doc');
    }
    closeDownloadDialog();
});

downloadCancel.addEventListener('click', closeDownloadDialog);

downloadDialog.addEventListener('click', (e) => {
    if (e.target === downloadDialog) {
        closeDownloadDialog();
    }
});

function openSavedNotesModal() {
    renderNotesList();
    savedNotesModal.style.display = 'flex';
}

function closeSavedNotesModal() {
    savedNotesModal.style.display = 'none';
}

// Menu dialog handlers
menuBtn.addEventListener('click', () => {
    menuDialog.style.display = 'flex';
});

menuDialog.addEventListener('click', (e) => {
    if (e.target === menuDialog) {
        menuDialog.style.display = 'none';
    }
});

// Export all notes
menuExport.addEventListener('click', () => {
    chrome.storage.local.get([STORAGE_KEY, ACTIVE_NOTE_KEY], (result) => {
        const payload = {
            notes: result[STORAGE_KEY] || [],
            activeNoteId: result[ACTIVE_NOTE_KEY] || null,
            exportedAt: new Date().toISOString(),
            version: 1
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0,10);
        a.href = url;
        a.download = `notepad-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        menuDialog.style.display = 'none';
    });
});

// Import notes
menuImport.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            
            // Validate basic structure
            if (!payload.notes || !Array.isArray(payload.notes)) {
                alert('Invalid backup file format');
                return;
            }
            
            // Validate and clean up notes
            const validNotes = payload.notes.filter(note => {
                return note.id && note.title !== undefined && note.content !== undefined;
            }).map(note => ({
                ...note,
                type: note.type || 'plain', 
                lastModified: note.lastModified || Date.now()
            }));
            
            // Restore to storage
            notes = validNotes;
            activeNoteId = payload.activeNoteId || null;
            
            await saveNotes();
            if (activeNoteId) {
                await saveActiveNoteId(activeNoteId);
            }
            
            // Load the active note or most recent
            if (activeNoteId && notes.find(n => n.id === activeNoteId)) {
                await loadNoteIntoEditor(activeNoteId);
            } else if (notes.length > 0) {
                await loadNoteIntoEditor(notes[0].id);
            } else {
                // No notes, create a draft
                createDraftNote();
            }
            
            renderNotesList();
            menuDialog.style.display = 'none';
            alert(`Successfully imported ${notes.length} note(s)`);
        } catch (err) {
            alert('Failed to import backup: ' + err.message);
        }
    });
    input.click();
});

function showNoteTypeDialog() {
    noteTypeDialog.style.display = 'flex';
}

async function createNewNote(noteType) {
    const newNote = {
        id: `note-${Date.now()}`,
        title: `New note ${notes.length + 1}`,
        content: '',
        type: noteType,
        lastModified: Date.now()
    };
    notes.unshift(newNote);
    await saveNotes();
    await loadNoteIntoEditor(newNote.id);
    closeSavedNotesModal();
    noteTypeDialog.style.display = 'none';
}

async function loadNoteIntoEditor(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        if (activeNoteId) {
            const prevNote = notes.find(n => n.id === activeNoteId);
            if (prevNote && prevNote.type === 'rich') {
                prevNote.content = JSON.stringify(quill.getContents());
                await saveNotes();
            }
        }
        
        activeNoteId = noteId;
        isFirstRunDraft = false;
        
        // Load based on note type
        if (note.type === 'rich') {
            try {
                const delta = note.content ? JSON.parse(note.content) : { ops: [] };
                quill.setContents(delta, 'silent');
            } catch (e) {
                quill.setContents({ ops: [] }, 'silent');
            }
            setEditorMode('rich');
        } else {
            plainTextArea.value = note.content;
            setEditorMode('plain');
        }
        
        updateNoteTitle(note.title);
        await saveActiveNoteId(noteId);
    }
}

savedNotesBtn.addEventListener('click', openSavedNotesModal);
closeSavedNotesBtn.addEventListener('click', closeSavedNotesModal);
newNoteBtn.addEventListener('click', showNoteTypeDialog);

// Note type dialog handlers
createPlainNote.addEventListener('click', () => createNewNote('plain'));
createRichNote.addEventListener('click', () => createNewNote('rich'));

noteTypeDialog.addEventListener('click', (e) => {
    if (e.target === noteTypeDialog) {
        noteTypeDialog.style.display = 'none';
    }
});

savedNotesModal.addEventListener('click', (e) => {
    if (e.target === savedNotesModal) {
        closeSavedNotesModal();
    }
});

// Auto-save on input with debounce
let saveTimer = null;

// Adds tab support for plain text
plainTextArea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = plainTextArea.selectionStart;
        const end = plainTextArea.selectionEnd;
        const value = plainTextArea.value;
        
        plainTextArea.value = value.substring(0, start) + '    ' + value.substring(end);
        
        plainTextArea.selectionStart = plainTextArea.selectionEnd = start + 4;
        
        plainTextArea.dispatchEvent(new Event('input'));
    }
});

plainTextArea.addEventListener('input', async () => {
    // If there's no active note, create one automatically
    if (!activeNoteId) {
        const newNote = {
            id: `note-${Date.now()}`,
            title: `New note ${notes.length + 1}`,
            content: plainTextArea.value,
            type: 'plain',
            lastModified: Date.now()
        };
        notes.unshift(newNote);
        activeNoteId = newNote.id;
        isFirstRunDraft = false;
        updateNoteTitle(newNote.title);
        await saveNotes();
        await saveActiveNoteId(activeNoteId);
        return;
    }
    
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        await saveNote(activeNoteId, plainTextArea.value);
    }, 500);
});

// Initialize notes on startup
async function initializeNotes() {
    await loadNotes();
    
    let lastActiveId = await loadActiveNoteId();
    
    if (lastActiveId && notes.find(n => n.id === lastActiveId)) {
        await loadNoteIntoEditor(lastActiveId);
        return;
    }
    
    if (notes.length > 0) {
        const mostRecent = notes.reduce((a, b) => 
            a.lastModified > b.lastModified ? a : b
        );
        await loadNoteIntoEditor(mostRecent.id);
        return;
    }
    
    await createDraftNote();
}

// Before closing/unloading, clean up empty first-run draft
window.addEventListener('beforeunload', async () => {
    if (isFirstRunDraft && activeNoteId) {
        const draftNote = notes.find(n => n.id === activeNoteId);
        if (draftNote && !draftNote.content.trim()) {
            notes = notes.filter(n => n.id !== activeNoteId);
            await saveNotes();
        }
    }
});

// Start the initialization
initializeNotes();

// ========================================
// DARK MODE
// ========================================

const DARK_MODE_KEY = 'dark_mode_enabled';

// Load dark mode preference
async function loadDarkMode() {
    return new Promise((resolve) => {
        chrome.storage.local.get([DARK_MODE_KEY], (result) => {
            resolve(result[DARK_MODE_KEY] || false);
        });
    });
}

// Save dark mode preference
async function saveDarkMode(enabled) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [DARK_MODE_KEY]: enabled }, resolve);
    });
}

// Toggle dark mode
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    saveDarkMode(isDark);
    
    // Update icon
    const icon = darkModeBtn.querySelector('.material-icons');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
}

// Initialize dark mode
loadDarkMode().then(isDark => {
    if (isDark) {
        document.body.classList.add('dark-mode');
        const icon = darkModeBtn.querySelector('.material-icons');
        icon.textContent = 'light_mode';
    }
});

// Dark mode button click handler
darkModeBtn.addEventListener('click', toggleDarkMode);

// INITIALIZE QUILL EDITOR
// ========================================


const Size = Quill.import('attributors/style/size');
const sizeWhitelist = ['10px', '11px', '12px', '13px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '32px', '36px', '48px', '72px'];
Size.whitelist = sizeWhitelist;
Quill.register(Size, true);

const Font = Quill.import('attributors/style/font');
Font.whitelist = ['Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana'];
Quill.register(Font, true);

const quill = new Quill('#richTextArea', {
    theme: 'snow',
    modules: {
        toolbar: false,
        keyboard: {
            bindings: {
                tab: {
                    key: 9,
                    handler: function(range, context) {
                        const format = this.quill.getFormat(range);
                        this.quill.insertText(range.index, '    ', format);
                        this.quill.setSelection(range.index + 4);
                        return false;
                    }
                }
            }
        }
    }
});

// DEFAULT FORMATTING
setTimeout(() => {
    if (quill.getLength() <= 1) { 
        quill.format('font', 'Arial');
        quill.format('size', '14px');
    }
}, 100);

// Block images from being pasted
const Delta = Quill.import('delta');
quill.clipboard.addMatcher('IMG', () => {
    return new Delta();
});

quill.root.addEventListener('copy', (e) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const container = document.createElement('div');
    container.appendChild(selection.getRangeAt(0).cloneContents());
    
    let html = container.innerHTML.replace(/<p><br><\/p>/g, '<p>\u00A0</p>');
    
    e.clipboardData.setData('text/html', html);
    e.clipboardData.setData('text/plain', quill.getText(quill.getSelection()));
    e.preventDefault();
});


// TOOLBAR BUTTON HANDLERS (Using Quill API)
// ========================================

// Store selection before toolbar clicks steal focus
let savedRange = null;

document.getElementById('toolbar').addEventListener('mousedown', (e) => {
    const range = quill.getSelection();
    if (range) {
        savedRange = range;
    }
    if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'OPTION') {
        e.preventDefault();
    }
});

// Helper to get a valid range
function getValidRange() {
    return quill.getSelection() || savedRange || { index: 0, length: 0 };
}

// Text formatting
boldBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    const currentFormat = quill.getFormat(range);
    const newValue = !currentFormat.bold;
    boldBtn.classList.toggle('active', newValue);
    quill.format('bold', newValue);
});

italicBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    const currentFormat = quill.getFormat(range);
    const newValue = !currentFormat.italic;
    italicBtn.classList.toggle('active', newValue);
    quill.format('italic', newValue);
});

underlineBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    const currentFormat = quill.getFormat(range);
    const newValue = !currentFormat.underline;
    underlineBtn.classList.toggle('active', newValue);
    quill.format('underline', newValue);
});

strikeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    const currentFormat = quill.getFormat(range);
    const newValue = !currentFormat.strike;
    strikeBtn.classList.toggle('active', newValue);
    quill.format('strike', newValue);
});

// Lists
ulBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    const currentFormat = quill.getFormat(range);
    quill.format('list', currentFormat.list === 'bullet' ? false : 'bullet');
});

olBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    const currentFormat = quill.getFormat(range);
    quill.format('list', currentFormat.list === 'ordered' ? false : 'ordered');
});

// Alignment
alignLeftBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    quill.format('align', false);
});

alignCenterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    quill.format('align', 'center');
});

alignRightBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    quill.setSelection(range.index, range.length, 'silent');
    quill.format('align', 'right');
});

// Clear formatting
clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const range = getValidRange();
    if (range && range.length > 0) {
        quill.setSelection(range.index, range.length, 'silent');
        quill.removeFormat(range.index, range.length);
    }
});

// Font family
fontSelect.addEventListener("focus", () => {
    const range = quill.getSelection();
    if (range) {
        savedRange = range;
    }
});

fontSelect.addEventListener("change", () => {
    const range = savedRange || getValidRange();
    const fontValue = fontSelect.value;
    
    if (range && fontValue) {
        if (range.length > 0) {
            quill.formatText(range.index, range.length, 'font', fontValue, 'user');
        } else {
            quill.format('font', fontValue, 'user');
        }
        lastKnownFormat.font = fontValue;
        
        setTimeout(() => {
            quill.focus();
            quill.setSelection(range.index, range.length);
        }, 10);
    }
});


// FONT SIZE CONTROLS
// ========================================

// Preset sizes for font
const presetSizes = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72];

// Toggle dropdown
fontSizeInput.addEventListener("mousedown", (e) => {
    const range = quill.getSelection();
    if (range) savedRange = range;
});

fontSizeInput.addEventListener("click", (e) => {
    e.stopPropagation();
    fontSizeDropdown.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (!fontSizeInput.contains(e.target) && !fontSizeDropdown.contains(e.target)) {
        fontSizeDropdown.classList.remove('show');
    }
});

// Handle dropdown options
document.querySelectorAll('.font-size-option').forEach(option => {
    option.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
    });
    option.addEventListener('click', (e) => {
        const size = parseInt(e.target.dataset.size);
        fontSizeInput.value = size;
        applyFontSize(size);
        fontSizeDropdown.classList.remove('show');
    });
});

// Increase/decrease buttons
increaseFontBtn.addEventListener("click", (e) => {
    e.preventDefault();
    let currentSize = parseInt(fontSizeInput.value);
    const nextSize = presetSizes.find(s => s > currentSize);
    if (nextSize) {
        fontSizeInput.value = nextSize;
        applyFontSize(nextSize);
    }
});

decreaseFontBtn.addEventListener("click", (e) => {
    e.preventDefault();
    let currentSize = parseInt(fontSizeInput.value);
    const prevSize = [...presetSizes].reverse().find(s => s < currentSize);
    if (prevSize) {
        fontSizeInput.value = prevSize;
        applyFontSize(prevSize);
    }
});

// Helper function to apply font size
function applyFontSize(size) {
    const range = getValidRange();
    const sizeStr = String(size).endsWith('px') ? size : size + 'px';
    quill.setSelection(range.index, range.length, 'silent');
    quill.format('size', sizeStr, 'user');
    lastKnownFormat.size = sizeStr;
}

// TOOLBAR STATE UPDATES
// ========================================

let lastKnownFormat = {
    font: 'Arial',
    size: '14px'
};

let toolbarTimer;
let isInternalUpdate = false;

function updateToolbarState() {
    if (isInternalUpdate) return;

    clearTimeout(toolbarTimer);
    toolbarTimer = setTimeout(() => {
        try {
            if (richTxt.style.display === 'none') return;
            
            const range = quill.getSelection();
            if (!range) return;

            const formats = quill.getFormat(range);
            
            // 1. UPDATE FONT SIZE DISPLAY
            let size = formats.size;
            if (Array.isArray(size)) size = size[0];
            
            if (size) {
                lastKnownFormat.size = size;
                const numericSize = parseInt(String(size).replace(/px/g, ''));
                fontSizeInput.value = isNaN(numericSize) ? 14 : numericSize;
            } else {
                fontSizeInput.value = 14; 
            }

            // 2. UPDATE FONT FAMILY
            let font = formats.font;
            if (Array.isArray(font)) font = font[0];
            fontSelect.value = font || 'Arial';

            // 3. UPDATE BUTTON STATES
            boldBtn.classList.toggle('active', !!formats.bold);
            italicBtn.classList.toggle('active', !!formats.italic);
            underlineBtn.classList.toggle('active', !!formats.underline);
            strikeBtn.classList.toggle('active', !!formats.strike);
            
            alignLeftBtn.classList.toggle('active', !formats.align);
            alignCenterBtn.classList.toggle('active', formats.align === 'center');
            alignRightBtn.classList.toggle('active', formats.align === 'right');

        } catch (err) {
        }
    }, 50);
}

// Update toolbar state when selection changes
quill.on('selection-change', function(range) {
    if (range) {
        updateToolbarState();
    }
});

// Also update when text changes
quill.on('text-change', function(delta, oldDelta, source) {
    updateToolbarState();
    
    // Auto-save rich text with debounce
    if (!activeNoteId || source === 'silent') return;
    
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        const note = notes.find(n => n.id === activeNoteId);
        if (note && note.type === 'rich') {
            note.content = JSON.stringify(quill.getContents());
            note.lastModified = Date.now();
            await saveNotes();
        }
    }, 500);
});