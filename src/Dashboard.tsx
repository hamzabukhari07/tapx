/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, MapPin, Link as LinkIcon, Loader2, QrCode, Download, Save, List, Edit2, Trash2, PlusCircle, Layers, FolderDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';

interface AdminUser {
  uid: string;
  username: string;
}

interface DashboardProps {
  user: AdminUser;
}

interface QrLink {
  id: string;
  destinationUrl: string;
  businessName: string;
  sequenceNumber: number;
}

export default function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'manage' | 'generate' | 'review'>('manage');

  // Review Link State
  const [mapLink, setMapLink] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [generatedReviewLink, setGeneratedReviewLink] = useState('');
  const [extractedBusinessName, setExtractedBusinessName] = useState('');
  
  // Dynamic QR State
  const [destinationUrl, setDestinationUrl] = useState('');
  const [qrLabel, setQrLabel] = useState('');
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const [dynamicLinkUrl, setDynamicLinkUrl] = useState('');
  const [currentBusinessName, setCurrentBusinessName] = useState('');
  const [copied, setCopied] = useState(false);

  // Bulk Generate State
  const [bulkCount, setBulkCount] = useState('');
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkResults, setBulkResults] = useState<QrLink[]>([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkCopiedId, setBulkCopiedId] = useState('');

  // Bulk Download ZIP State
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  // Saved Links State
  const [savedLinks, setSavedLinks] = useState<QrLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);

  // Manage Tab Filter State
  const [manageTab, setManageTab] = useState<'all' | 'active' | 'inactive'>('all');

  // Edit State
  const [editingLink, setEditingLink] = useState<QrLink | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const response = await fetch('/api/qr-links');
      const data = await response.json();
      if (response.ok && data.links) {
        setSavedLinks(data.links);
        // If there are no links created yet, suggest the generate tab
        if (data.links.length === 0) {
          setActiveTab('generate');
        }
      }
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setIsLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleExtractReviewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapLink.trim()) return;
    
    setIsExtracting(true);
    setExtractError('');
    setGeneratedReviewLink('');
    setExtractedBusinessName('');
    
    try {
      const response = await fetch('/api/extract-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mapLink.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok && data.reviewLink) {
        setExtractedBusinessName(data.name || 'Google Business');
        setGeneratedReviewLink(data.reviewLink);
      } else {
        setExtractError(data.error || 'Failed to extract place information.');
      }
    } catch (err) {
      setExtractError('An error occurred while connecting to the server.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreateDynamicQr = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingQr(true);
    setDynamicLinkUrl('');
    
    try {
      const response = await fetch('/api/qr-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: '',
          businessName: 'Unassigned QR Code'
        })
      });
      
      const data = await response.json().catch(() => null);
      if (response.ok && data?.id) {
        setCurrentBusinessName('Unassigned QR Code');
        setDynamicLinkUrl(`${window.location.origin}/scan/${data.id}`);
        fetchLinks();
      } else {
        alert(data?.error || 'Failed to create dynamic QR code.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to create dynamic QR code.');
    } finally {
      setIsCreatingQr(false);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Math.floor(Number(bulkCount));
    if (!Number.isFinite(num) || num <= 0 || num > 500) {
      setBulkError('Enter a number between 1 and 500.');
      return;
    }

    setIsBulkCreating(true);
    setBulkError('');
    setBulkResults([]);

    try {
      const response = await fetch('/api/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: num })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        setBulkResults(data.links || []);
        setBulkCount('');
        fetchLinks();
      } else {
        setBulkError(data?.error || 'Failed to bulk generate QR codes.');
      }
    } catch (err: any) {
      console.error(err);
      setBulkError(err?.message || 'Failed to bulk generate QR codes.');
    } finally {
      setIsBulkCreating(false);
    }
  };

  const handleCopy = async (url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadQRCode = (url: string, name: string, elementId: string) => {
    const canvas = document.getElementById(elementId) as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}_review_qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const handleDownloadZip = async (linksToDownload: QrLink[], zipName = 'TapX_QR_Codes.zip') => {
    if (!linksToDownload || linksToDownload.length === 0) return;
    setIsDownloadingZip(true);
    setZipProgress(`0/${linksToDownload.length}`);

    try {
      const zip = new JSZip();
      const folder = zip.folder('TapX_QR_Codes') || zip;

      for (let i = 0; i < linksToDownload.length; i++) {
        const link = linksToDownload[i];
        const cardSeq = (link.sequenceNumber !== undefined && link.sequenceNumber !== null)
          ? link.sequenceNumber
          : savedLinks.findIndex((l) => l.id === link.id);
        const seqStr = String(cardSeq >= 0 ? cardSeq : i).padStart(2, '0');

        let name = link.businessName || 'Unassigned';
        if (!name || name === 'Unassigned QR Code') {
          if (link.destinationUrl) {
            try {
              name = new URL(link.destinationUrl).hostname.replace(/^www\./, '');
            } catch {
              name = 'QR_Card';
            }
          } else {
            name = 'Unassigned';
          }
        }

        const cleanName = name.replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, '_').substring(0, 30);
        const filename = `#${seqStr}_${cleanName}.png`;
        const scanUrl = `${window.location.origin}/scan/${link.id}`;

        const dataUrl = await QRCode.toDataURL(scanUrl, {
          width: 600,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });

        const base64Data = dataUrl.split(',')[1];
        folder.file(filename, base64Data, { base64: true });

        setZipProgress(`${i + 1}/${linksToDownload.length}`);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const linkEl = document.createElement('a');
      linkEl.href = downloadUrl;
      linkEl.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
      document.body.appendChild(linkEl);
      linkEl.click();
      document.body.removeChild(linkEl);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download ZIP:', error);
      alert('Failed to generate ZIP archive.');
    } finally {
      setIsDownloadingZip(false);
      setZipProgress('');
    }
  };

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editUrl.trim()) return;

    let formattedUrl = editUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl) && !formattedUrl.startsWith('/')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    let finalName = editName.trim();
    if (!finalName || finalName === 'Unassigned QR Code') {
      try {
        const hostname = new URL(formattedUrl).hostname.replace(/^www\./, '');
        finalName = hostname;
      } catch {
        finalName = 'Google Business';
      }
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/qr-links/${editingLink.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: formattedUrl,
          businessName: finalName
        })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        setEditingLink(null);
        setEditUrl('');
        setEditName('');
        fetchLinks();
      } else {
        alert(data?.error || 'Failed to update link. Please make sure the destination URL is valid.');
      }
    } catch (error: any) {
      console.error('Failed to update link', error);
      alert(error?.message || 'Failed to update link. Please check your network.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnassignLink = async (id: string) => {
    if (!window.confirm('Are you sure you want to unassign this QR code? It will redirect to the setup page when scanned until re-assigned.')) return;
    
    try {
      const response = await fetch(`/api/qr-links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: '',
          businessName: 'Unassigned QR Code'
        })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        fetchLinks();
      } else {
        alert(data?.error || 'Failed to unassign link.');
      }
    } catch (error: any) {
      console.error('Failed to unassign link', error);
      alert(error?.message || 'Failed to unassign link.');
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this QR code link? It will immediately stop working for anyone who scans it.')) return;
    
    try {
      const response = await fetch(`/api/qr-links/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        fetchLinks();
      } else {
        alert(data?.error || 'Failed to delete link.');
      }
    } catch (error: any) {
      console.error('Failed to delete link', error);
      alert(error?.message || 'Failed to delete link.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-53px)] bg-slate-50 flex flex-col items-center py-4 sm:py-8 px-2.5 sm:px-4 text-slate-900 font-sans overflow-x-hidden">
      
      {/* Main Navigation Tabs */}
      <div className="w-full max-w-xl grid grid-cols-3 p-1 bg-slate-200/80 rounded-xl mb-4 sm:mb-6 shadow-inner gap-1">
        <button
          onClick={() => setActiveTab('review')}
          className={`py-2 sm:py-2.5 px-1.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
            activeTab === 'review' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <MapPin size={15} className="shrink-0" />
          <span className="truncate">Review Link</span>
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`py-2 sm:py-2.5 px-1.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
            activeTab === 'generate' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <QrCode size={15} className="shrink-0" />
          <span className="truncate">Dynamic QR</span>
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`py-2 sm:py-2.5 px-1.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
            activeTab === 'manage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <List size={15} className="shrink-0" />
          <span className="truncate">Manage</span>
        </button>
      </div>

      <div className="w-full max-w-xl">
        {/* Review Link Tab */}
        {activeTab === 'review' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-4 sm:p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800">Extract Review Link</h2>
                  <p className="text-slate-500 text-xs sm:text-sm">Paste a Google Maps link to get the direct review URL.</p>
                </div>
              </div>

              <form onSubmit={handleExtractReviewLink} className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Google Maps Link
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={mapLink}
                      onChange={(e) => setMapLink(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 pl-9 sm:pl-10 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white"
                      required
                    />
                    <LinkIcon size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  </div>
                  {extractError && (
                    <p className="text-red-500 text-xs mt-2">{extractError}</p>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={isExtracting || !mapLink}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 sm:py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  {isExtracting ? <><Loader2 size={18} className="animate-spin" /> Extracting...</> : 'Extract Link'}
                </button>
              </form>

              <AnimatePresence>
                {generatedReviewLink && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 overflow-hidden"
                  >
                    <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
                      <div className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Review Link {extractedBusinessName ? `for ${extractedBusinessName.split(',')[0]}` : ''}
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-700 overflow-x-auto whitespace-nowrap scrollbar-hide select-all">
                          {generatedReviewLink}
                        </div>
                        <button
                          onClick={() => handleCopy(generatedReviewLink)}
                          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer ${
                            copied 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 active:scale-95'
                          }`}
                          title="Copy to clipboard"
                        >
                          {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Dynamic QR Generator Tab */}
        {activeTab === 'generate' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-4 sm:p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <QrCode size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800">New Dynamic QR</h2>
                  <p className="text-slate-500 text-xs sm:text-sm">Create an updateable QR code for any URL.</p>
                </div>
              </div>

              <form onSubmit={handleCreateDynamicQr} className="space-y-4">
                <button
                  type="submit"
                  disabled={isCreatingQr}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3.5 sm:py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-base sm:text-lg shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  {isCreatingQr ? <><Loader2 size={20} className="animate-spin" /> Creating...</> : <><PlusCircle size={20} className="sm:w-6 sm:h-6" /> Create Blank QR Code</>}
                </button>
                <p className="text-slate-500 text-xs sm:text-sm text-center">
                  Once generated, you can print the QR code immediately. Scan it anytime to attach or update its destination URL.
                </p>
              </form>

              <AnimatePresence>
                {dynamicLinkUrl && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100"
                  >
                    <div className="bg-emerald-50 text-emerald-700 p-3.5 sm:p-4 rounded-xl mb-5 sm:mb-6 text-xs sm:text-sm font-medium border border-emerald-100 flex gap-2">
                      <Check size={18} className="shrink-0 mt-0.5" />
                      <div>
                        QR code successfully created! It is saved to your account and ready to print.
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs mb-4">
                        <QRCodeCanvas
                          id="new-qr"
                          value={dynamicLinkUrl}
                          size={160}
                          bgColor={"#ffffff"}
                          fgColor={"#0f172a"}
                          level={"H"}
                          className="w-40 h-40 sm:w-48 sm:h-48"
                        />
                      </div>
                      <button
                        onClick={() => downloadQRCode(dynamicLinkUrl, currentBusinessName, 'new-qr')}
                        className="w-full max-w-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        <Download size={16} /> Download QR Code
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="my-6 sm:my-8 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Bulk Generate</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <form onSubmit={handleBulkGenerate} className="space-y-4 sm:space-y-5">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <Layers size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base">Generate Multiple QR Codes</h3>
                      <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                        Enter how many QR codes you need. Each one gets a permanent sequence number (#00, #01, #02...) that never changes.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                    How many QR codes to generate?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="grid grid-cols-4 gap-1.5 flex-1">
                      {[5, 10, 20, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setBulkCount(String(n))}
                          className={`py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition-all cursor-pointer ${
                            bulkCount === String(n)
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={bulkCount}
                        onChange={(e) => setBulkCount(e.target.value)}
                        placeholder="Custom N"
                        className="w-full sm:w-28 px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-center font-semibold bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>
                  {bulkError && (
                    <p className="text-red-500 text-xs mt-2">{bulkError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isBulkCreating || !bulkCount}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3 sm:py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer text-sm sm:text-base active:scale-[0.98]"
                >
                  {isBulkCreating ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : <><Layers size={18} /> Generate {bulkCount ? `${bulkCount} QR Codes` : 'QR Codes'}</>}
                </button>
              </form>

              <AnimatePresence>
                {bulkResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100"
                  >
                    <div className="bg-emerald-50 text-emerald-700 p-3.5 sm:p-4 rounded-xl mb-4 sm:mb-6 text-xs sm:text-sm font-medium border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex gap-2 items-start sm:items-center">
                        <Check size={18} className="shrink-0 mt-0.5 sm:mt-0" />
                        <div>
                          Generated {bulkResults.length} QR codes with sequence numbers #{String(bulkResults[0]?.sequenceNumber).padStart(2, '0')} &ndash; #{String(bulkResults[bulkResults.length - 1]?.sequenceNumber).padStart(2, '0')}.
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const first = String(bulkResults[0]?.sequenceNumber ?? 0).padStart(2, '0');
                          const last = String(bulkResults[bulkResults.length - 1]?.sequenceNumber ?? 0).padStart(2, '0');
                          handleDownloadZip(bulkResults, `TapX_Batch_${first}-${last}.zip`);
                        }}
                        disabled={isDownloadingZip}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        title="Download all generated QR codes in this batch as a ZIP file"
                      >
                        {isDownloadingZip ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Downloading {zipProgress}...</span>
                          </>
                        ) : (
                          <>
                            <FolderDown size={15} />
                            <span>Download Batch (ZIP)</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      {bulkResults.map((link) => {
                        const scanUrl = `${window.location.origin}/scan/${link.id}`;
                        const seq = link.sequenceNumber;
                        const seqLabel = String(seq).padStart(2, '0');
                        return (
                          <div key={link.id} className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50 flex flex-col items-center gap-1.5 sm:gap-2">
                            <span className="bg-blue-600 text-white font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md w-full text-center shadow-2xs">
                              #{seqLabel}
                            </span>
                            <div className="bg-white p-1.5 sm:p-2 rounded-lg border border-slate-100">
                              <QRCodeCanvas id={`bulk-qr-${link.id}`} value={scanUrl} size={80} level={"H"} className="w-20 h-20 sm:w-24 sm:h-24" />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 truncate w-full text-center" title={scanUrl}>
                              {scanUrl}
                            </span>
                            <button
                              onClick={() => { handleCopy(scanUrl); setBulkCopiedId(link.id); }}
                              className="w-full py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              {bulkCopiedId === link.id ? <><Check size={12} className="text-emerald-500" /> Copied</> : <><Copy size={12} /> Copy</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Manage Links Tab */}
        {activeTab === 'manage' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <List size={20} className="text-slate-400" /> My Links
                </h2>
                {savedLinks.length > 0 && (
                  <button
                    onClick={() => {
                      const filtered = savedLinks.filter((link) => {
                        const hasDest = !!link.destinationUrl && !!link.destinationUrl.trim();
                        if (manageTab === 'active') return hasDest;
                        if (manageTab === 'inactive') return !hasDest;
                        return true;
                      });
                      const tabName = manageTab === 'all' ? 'All' : manageTab === 'active' ? 'Active' : 'Pending';
                      handleDownloadZip(filtered, `TapX_${tabName}_QRCodes.zip`);
                    }}
                    disabled={isDownloadingZip}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 self-start sm:self-auto"
                    title="Download all displayed QR codes in a ZIP file"
                  >
                    {isDownloadingZip ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Downloading {zipProgress}...</span>
                      </>
                    ) : (
                      <>
                        <FolderDown size={14} />
                        <span>Download {manageTab === 'all' ? 'All' : manageTab === 'active' ? 'Active' : 'Pending'} (ZIP)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-4 sm:mb-6">
                <button
                  onClick={() => setManageTab('all')}
                  className={`py-2 px-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                    manageTab === 'all' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All</span>
                  <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${manageTab === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                    {savedLinks.length}
                  </span>
                </button>
                <button
                  onClick={() => setManageTab('active')}
                  className={`py-2 px-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                    manageTab === 'active' ? 'bg-emerald-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${manageTab === 'active' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                  <span>Active</span>
                  <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${manageTab === 'active' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {savedLinks.filter(l => l.destinationUrl && l.destinationUrl.trim()).length}
                  </span>
                </button>
                <button
                  onClick={() => setManageTab('inactive')}
                  className={`py-2 px-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                    manageTab === 'inactive' ? 'bg-amber-500 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${manageTab === 'inactive' ? 'bg-white' : 'bg-amber-500'}`}></span>
                  <span className="truncate">Pending</span>
                  <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${manageTab === 'inactive' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {savedLinks.filter(l => !l.destinationUrl || !l.destinationUrl.trim()).length}
                  </span>
                </button>
              </div>
              
              {isLoadingLinks ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={32} className="animate-spin text-slate-400" />
                </div>
              ) : savedLinks.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100 p-4">
                  You haven't created any dynamic QR codes yet.
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {(() => {
                    const filteredLinks = savedLinks.filter((link) => {
                      const hasDest = !!link.destinationUrl && !!link.destinationUrl.trim();
                      if (manageTab === 'active') return hasDest;
                      if (manageTab === 'inactive') return !hasDest;
                      return true;
                    });
                    if (filteredLinks.length === 0) {
                      return (
                        <div className="py-10 text-center text-slate-500 text-xs sm:text-sm bg-slate-50 rounded-xl border border-slate-100 p-4">
                          {manageTab === 'active'
                            ? "No active QR codes yet. Assign a destination to activate them."
                            : manageTab === 'inactive'
                            ? "No unassigned QR codes. All links are active."
                            : "You haven't created any dynamic QR codes yet."}
                        </div>
                      );
                    }
                    return (
                      <>
                        {filteredLinks.map((link) => {
                          const scanUrl = `${window.location.origin}/scan/${link.id}`;
                          const isEditing = editingLink?.id === link.id;
                          const isUnassigned = !link.destinationUrl || !link.destinationUrl.trim();
                          const cardSeq = (link.sequenceNumber !== undefined && link.sequenceNumber !== null)
                            ? link.sequenceNumber
                            : savedLinks.findIndex((l) => l.id === link.id);
                          const cardNumber = String(cardSeq >= 0 ? cardSeq : 0).padStart(2, '0');

                          let displayName = link.businessName;
                          if (!displayName || displayName === 'Unassigned QR Code') {
                            if (link.destinationUrl) {
                              try {
                                displayName = new URL(link.destinationUrl).hostname.replace(/^www\./, '');
                              } catch {
                                displayName = `QR Card #${cardNumber}`;
                              }
                            } else {
                              displayName = `Unassigned QR Code`;
                            }
                          }

                          return (
                            <div key={link.id} className="p-3.5 sm:p-5 border border-slate-200 rounded-xl sm:rounded-2xl bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all shadow-2xs">
                              {/* Header row: Badge, Name, Status, and Action buttons */}
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 mb-3">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="bg-blue-600 text-white font-mono text-xs font-bold px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                                    #{cardNumber}
                                  </span>
                                  <div className={`font-bold text-sm sm:text-base truncate max-w-[200px] sm:max-w-xs md:max-w-md ${isUnassigned ? 'text-slate-500' : 'text-slate-900'}`}>
                                    {displayName}
                                  </div>
                                  {isUnassigned ? (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap border border-amber-200 shrink-0">
                                      Needs Setup
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap border border-emerald-200 flex items-center gap-1 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                                    </span>
                                  )}
                                </div>
                                
                                {/* Action Buttons Toolbar */}
                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  <button 
                                    onClick={() => { 
                                      setEditingLink(link); 
                                      setEditUrl(link.destinationUrl || ''); 
                                      setEditName(link.businessName === 'Unassigned QR Code' ? '' : link.businessName || ''); 
                                    }}
                                    className="p-1.5 sm:p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                                    title={isUnassigned ? "Setup destination" : "Edit destination"}
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button 
                                    onClick={() => handleCopy(scanUrl)}
                                    className="p-1.5 sm:p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                                    title="Copy scan link"
                                  >
                                    {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                                  </button>
                                  <button 
                                    onClick={() => downloadQRCode(scanUrl, `${cardNumber}_${displayName}`, `qr-${link.id}`)}
                                    className="p-1.5 sm:p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                                    title="Download QR"
                                  >
                                    <Download size={15} />
                                  </button>
                                  {!isUnassigned && (
                                    <button 
                                      onClick={() => handleUnassignLink(link.id)}
                                      className="p-1.5 sm:p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                                      title="Unassign URL (keep QR)"
                                    >
                                      <LinkIcon size={15} className="opacity-60 line-through" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleDeleteLink(link.id)}
                                    className="p-1.5 sm:p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                                    title="Delete Link Permanently"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                              
                              {/* QR Preview & Link Details */}
                              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center sm:items-stretch bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 mb-2.5">
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shrink-0 flex items-center justify-center">
                                  <QRCodeCanvas id={`qr-${link.id}`} value={scanUrl} size={95} level={"H"} className="w-[95px] h-[95px] sm:w-[105px] sm:h-[105px]" />
                                </div>
                                <div className="flex-1 w-full min-w-0 flex flex-col justify-center">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Permanent Scan Link</span>
                                    <span className="text-[10px] font-mono text-slate-400 shrink-0">ID: {link.id}</span>
                                  </div>
                                  <div className="text-[11px] sm:text-xs text-slate-700 font-mono break-all bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2 select-all flex items-center justify-between gap-2">
                                    <span className="truncate">{scanUrl}</span>
                                    <button 
                                      type="button" 
                                      onClick={() => handleCopy(scanUrl)} 
                                      className="text-slate-400 hover:text-blue-600 p-1 shrink-0 cursor-pointer"
                                      title="Copy scan link"
                                    >
                                      <Copy size={13} />
                                    </button>
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">
                                    <span className="font-semibold text-slate-700">Destination: </span>
                                    {link.destinationUrl ? (
                                      <span className="font-mono text-slate-800 text-[11px] break-all">{link.destinationUrl}</span>
                                    ) : (
                                      <span className="text-amber-600 font-medium">Not configured yet</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Edit drawer or Status footer */}
                              {isEditing ? (
                                <form onSubmit={handleUpdateLink} className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                      Card / Business Name (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      placeholder="e.g. Front Desk, Google Review Card, Hamza"
                                      className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                      Destination URL (Where scan will redirect)
                                    </label>
                                    <input
                                      type="url"
                                      value={editUrl}
                                      onChange={(e) => setEditUrl(e.target.value)}
                                      placeholder="https://..."
                                      className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                      required
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button 
                                      type="button" 
                                      disabled={isUpdating}
                                      onClick={() => { setEditingLink(null); setEditUrl(''); setEditName(''); }}
                                      className="text-xs sm:text-sm px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium disabled:opacity-50 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      type="submit" 
                                      disabled={isUpdating}
                                      className="text-xs sm:text-sm px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-all flex items-center gap-1.5 font-medium shadow-xs cursor-pointer active:scale-95"
                                    >
                                      {isUpdating ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Save size={15} /> Save Changes</>}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div className={`mt-2.5 pt-2.5 border-t border-slate-200/80 text-xs truncate flex items-center gap-1.5 ${isUnassigned ? 'text-amber-600' : 'text-emerald-700 font-medium'}`}>
                                  {isUnassigned ? (
                                    <>
                                      <PlusCircle size={13} className="shrink-0 text-amber-500" />
                                      <span className="truncate">Click the edit button above to set a destination URL.</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check size={13} className="shrink-0 text-emerald-600" /> 
                                      <span className="truncate">Redirects to: <strong className="text-slate-800 font-mono text-[11px] underline underline-offset-2">{link.destinationUrl}</strong></span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

