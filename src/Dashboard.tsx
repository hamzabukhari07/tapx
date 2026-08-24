/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, MapPin, Link as LinkIcon, Loader2, QrCode, Download, Save, List, Edit2, Trash2, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';

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
  
  // Saved Links State
  const [savedLinks, setSavedLinks] = useState<QrLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);

  // Edit State
  const [editingLink, setEditingLink] = useState<QrLink | null>(null);
  const [editUrl, setEditUrl] = useState('');
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

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editUrl.trim()) return;

    let formattedUrl = editUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl) && !formattedUrl.startsWith('/')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/qr-links/${editingLink.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: formattedUrl
        })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        setEditingLink(null);
        setEditUrl('');
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
    <div className="min-h-[calc(100vh-53px)] bg-slate-50 flex flex-col items-center py-8 px-4 text-slate-900 font-sans">
      
      {/* Tabs */}
      <div className="w-full max-w-xl flex p-1 bg-slate-200 rounded-lg mb-8">
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'review' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapPin size={16} /> Review Link
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'generate' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <QrCode size={16} /> Dynamic QR
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'manage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <List size={16} /> Manage Links
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
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <MapPin size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Extract Review Link</h2>
                  <p className="text-slate-500 text-sm">Paste a Google Maps link to get the direct review URL.</p>
                </div>
              </div>

              <form onSubmit={handleExtractReviewLink} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Google Maps Link
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={mapLink}
                      onChange={(e) => setMapLink(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full px-4 py-3 pl-10 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      required
                    />
                    <LinkIcon size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  </div>
                  {extractError && (
                    <p className="text-red-500 text-xs mt-2">{extractError}</p>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={isExtracting || !mapLink}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isExtracting ? <><Loader2 size={18} className="animate-spin" /> Extracting...</> : 'Extract Link'}
                </button>
              </form>

              <AnimatePresence>
                {generatedReviewLink && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-8 pt-8 border-t border-slate-100 overflow-hidden"
                  >
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Review Link {extractedBusinessName ? `for ${extractedBusinessName.split(',')[0]}` : ''}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 overflow-x-auto whitespace-nowrap scrollbar-hide">
                          {generatedReviewLink}
                        </div>
                        <button
                          onClick={() => handleCopy(generatedReviewLink)}
                          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                            copied 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <QrCode size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">New Dynamic QR</h2>
                  <p className="text-slate-500 text-sm">Create an updateable QR code for any URL.</p>
                </div>
              </div>

              <form onSubmit={handleCreateDynamicQr} className="space-y-5">
                <button
                  type="submit"
                  disabled={isCreatingQr}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-sm"
                >
                  {isCreatingQr ? <><Loader2 size={24} className="animate-spin" /> Creating...</> : <><PlusCircle size={24} /> Create Blank Printable QR Code</>}
                </button>
                <p className="text-slate-500 text-sm text-center">
                  Once generated, you can print the QR code immediately. Scan it with your mobile phone to attach a destination URL.
                </p>
              </form>

              <AnimatePresence>
                {dynamicLinkUrl && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-8 pt-8 border-t border-slate-100"
                  >
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-6 text-sm font-medium border border-emerald-100 flex gap-2">
                      <Check size={20} className="shrink-0 mt-0.5" />
                      <div>
                        QR code successfully created! It is saved to your account and ready to print.
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                        <QRCodeCanvas
                          id="new-qr"
                          value={dynamicLinkUrl}
                          size={200}
                          bgColor={"#ffffff"}
                          fgColor={"#0f172a"}
                          level={"H"}
                        />
                      </div>
                      <button
                        onClick={() => downloadQRCode(dynamicLinkUrl, currentBusinessName, 'new-qr')}
                        className="w-full max-w-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Download size={18} /> Download QR Code
                      </button>
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
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <List size={22} className="text-slate-400" /> My Links
                </h2>
              </div>
              
              {isLoadingLinks ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={32} className="animate-spin text-slate-400" />
                </div>
              ) : savedLinks.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100">
                  You haven't created any dynamic QR codes yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {savedLinks.map(link => {
                    const scanUrl = `${window.location.origin}/scan/${link.id}`;
                    const isEditing = editingLink?.id === link.id;
                    const isUnassigned = !link.destinationUrl || link.businessName === 'Unassigned QR Code';

                    return (
                      <div key={link.id} className="p-5 border border-slate-200 rounded-xl bg-slate-50 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2 pr-4">
                            <div className={`font-semibold text-base truncate ${isUnassigned ? 'text-slate-500' : 'text-slate-800'}`}>
                              {link.businessName}
                            </div>
                            {isUnassigned && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                Needs Setup
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button 
                              onClick={() => { setEditingLink(link); setEditUrl(link.destinationUrl); }}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-slate-200 rounded-lg"
                              title={isUnassigned ? "Setup destination" : "Edit destination"}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleCopy(scanUrl)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-slate-200 rounded-lg"
                              title="Copy scan link"
                            >
                              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                            <button 
                              onClick={() => downloadQRCode(scanUrl, link.businessName, `qr-${link.id}`)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-slate-200 rounded-lg"
                              title="Download QR"
                            >
                              <Download size={16} />
                            </button>
                            {!isUnassigned && (
                              <button 
                                onClick={() => handleUnassignLink(link.id)}
                                className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors bg-white border border-slate-200 rounded-lg ml-2"
                                title="Unassign URL (keep QR)"
                              >
                                <LinkIcon size={16} className="opacity-50 line-through" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteLink(link.id)}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors bg-white border border-slate-200 rounded-lg ml-1"
                              title="Delete Link Permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 mb-3">
                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
                            <QRCodeCanvas id={`qr-${link.id}`} value={scanUrl} size={110} level={"H"} />
                          </div>
                          <div className="flex-1 w-full min-w-0">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Permanent Scan Link</div>
                            <div className="text-xs text-slate-700 font-mono break-all bg-slate-50 p-2 rounded border border-slate-100 mb-2 select-all">
                              {scanUrl}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              <span className="font-medium text-slate-700">Destination: </span>
                              {link.destinationUrl ? link.destinationUrl : <span className="text-amber-600 font-medium">Not configured yet</span>}
                            </div>
                          </div>
                        </div>

                        {isEditing ? (
                          <form onSubmit={handleUpdateLink} className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">New Destination URL</label>
                            <input
                              type="text"
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-3"
                              required
                            />
                            <div className="flex gap-2 justify-end">
                              <button 
                                type="button" 
                                disabled={isUpdating}
                                onClick={() => setEditingLink(null)}
                                className="text-sm px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button 
                                type="submit"
                                disabled={isUpdating}
                                className="text-sm px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors flex items-center gap-2 font-medium"
                              >
                                {isUpdating ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className={`mt-3 pt-3 border-t border-slate-200 text-xs truncate flex items-center gap-1.5 ${isUnassigned ? 'text-amber-600' : 'text-slate-500'}`}>
                            {isUnassigned ? (
                              <>
                                <PlusCircle size={12} className="shrink-0" />
                                Please click the edit icon above to set a destination.
                              </>
                            ) : (
                              <>
                                <LinkIcon size={12} className="shrink-0" /> 
                                Redirects to: {link.destinationUrl}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

