import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playScanBeepSound, scanImageData, scanImageFile } from '../utils/qrScanner';
import { 
  PlusCircle, 
  Check, 
  CheckCircle, 
  AlertCircle, 
  Camera, 
  Trash2, 
  Search, 
  Building, 
  User, 
  Calendar, 
  Printer, 
  Share2, 
  Send, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Plus, 
  Phone, 
  ShieldCheck, 
  AlertTriangle,
  Upload,
  X,
  FileText,
  Smartphone,
  Eye,
  Info
} from 'lucide-react';
import { WarrantyItem, ActiveTab } from '../types';

interface P006DeviceReceptionProps {
  warrantyDb: WarrantyItem[];
  setWarrantyDb: React.Dispatch<React.SetStateAction<WarrantyItem[]>>;
  customers: any[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  products: any[];
  setProducts: React.Dispatch<React.SetStateAction<any[]>>;
  userRole: 'admin' | 'reception' | 'technician' | 'delivery';
  setActiveTab: (tab: ActiveTab) => void;
  setQueueFilter: (filter: any) => void;
  onRedirectToSale?: (serial: string) => void;
  templateDevice?: WarrantyItem | null;
  setTemplateDevice?: React.Dispatch<React.SetStateAction<WarrantyItem | null>>;
}

export default function P006DeviceReception({
  warrantyDb,
  setWarrantyDb,
  customers,
  setCustomers,
  products,
  setProducts,
  userRole,
  setActiveTab,
  setQueueFilter,
  onRedirectToSale,
  templateDevice,
  setTemplateDevice
}: P006DeviceReceptionProps) {
  // Wizard steps: 1 = Identify, 2 = Info, 3 = Defect, 4 = Physical & Accessories, 5 = Final/Submit
  const [step, setStep] = useState<number>(1);
  
  // Step 1: Identification States
  const extractedPrefixes = React.useMemo(() => {
    const set = new Set<string>(['DEC', 'DU', 'W']); // defaults from instructions
    if (products && Array.isArray(products)) {
      products.forEach(p => {
        if (p.model && typeof p.model === 'string') {
          const firstPart = p.model.split('-')[0].trim().toUpperCase();
          if (firstPart && isNaN(Number(firstPart))) {
            set.add(firstPart);
          }
        }
        if (p.code && typeof p.code === 'string') {
          const parts = p.code.split('-');
          parts.forEach(part => {
            const clean = part.trim().toUpperCase();
            if (clean && isNaN(Number(clean)) && clean.length >= 2 && clean.length <= 5) {
              set.add(clean);
            }
          });
        }
      });
    }
    return Array.from(set);
  }, [products]);

  const initialSerial = warrantyDb[0]?.serial || '';
  const [serialInput, setSerialInput] = useState<string>(initialSerial);

  const [selectedPrefix, setSelectedPrefix] = useState<string>(() => {
    if (initialSerial.includes('-')) {
      return initialSerial.split('-')[0].toUpperCase();
    }
    return 'DEC';
  });

  const [serialNumberInput, setSerialNumberInput] = useState<string>(() => {
    if (initialSerial.includes('-')) {
      return initialSerial.split('-')[1];
    }
    return '';
  });

  const [searchState, setSearchState] = useState<'idle' | 'found' | 'not_found'>('found');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [foundItem, setFoundItem] = useState<WarrantyItem | null>(warrantyDb[0] || null);

  const receptionVideoRef = useRef<HTMLVideoElement | null>(null);
  const [receptionCameraStream, setReceptionCameraStream] = useState<MediaStream | null>(null);

  React.useEffect(() => {
    let scanInterval: any = null;
    let activeStream: MediaStream | null = null;
    if (isScanning) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(stream => {
            activeStream = stream;
            setReceptionCameraStream(stream);
            if (receptionVideoRef.current) {
              receptionVideoRef.current.srcObject = stream;
            }
          })
          .catch(err => {
            console.warn("Reception scanner camera access error:", err);
          });
      }

      const scanCanvas = document.createElement('canvas');
      scanInterval = setInterval(async () => {
        if (receptionVideoRef.current && receptionVideoRef.current.readyState === receptionVideoRef.current.HAVE_ENOUGH_DATA) {
          scanCanvas.width = receptionVideoRef.current.videoWidth || 300;
          scanCanvas.height = receptionVideoRef.current.videoHeight || 300;
          const ctx = scanCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(receptionVideoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
            const scannedCode = await scanImageData(scanCanvas);
            if (scannedCode) {
              playScanBeepSound();
              handleSimulateScan(scannedCode);
            }
          }
        }
      }, 400);
    } else {
      if (receptionCameraStream) {
        receptionCameraStream.getTracks().forEach(t => t.stop());
        setReceptionCameraStream(null);
      }
    }
    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isScanning]);

  // Keep serialInput synced with selection
  React.useEffect(() => {
    if (serialNumberInput) {
      setSerialInput(`${selectedPrefix}-${serialNumberInput}`);
    } else {
      setSerialInput('');
    }
  }, [selectedPrefix, serialNumberInput]);

  // Template pre-fill effect
  React.useEffect(() => {
    if (templateDevice) {
      const serial = templateDevice.serial;
      setSerialInput(serial);
      if (serial.includes('-')) {
        const parts = serial.split('-');
        setSelectedPrefix(parts[0].toUpperCase());
        setSerialNumberInput(parts.slice(1).join('-'));
      } else {
        setSerialNumberInput(serial);
      }
      setFoundItem(templateDevice);
      setIsWarrantless(false);
      setSearchState('found');
      setStep(3); // Go directly to step 3 (defect registration)
      showToast(`اطلاعات دستگاه ${templateDevice.itemName} با موفقیت الگوبرداری شد.`, 'success');
      if (setTemplateDevice) {
        setTemplateDevice(null);
      }
    }
  }, [templateDevice, setTemplateDevice]);

  // Warrantless form states (if serial is not found and user selects پذیرش بدون گارانتی)
  const [isWarrantless, setIsWarrantless] = useState<boolean>(false);
  const [warrantlessName, setWarrantlessName] = useState<string>('');
  const [warrantlessPhone, setWarrantlessPhone] = useState<string>('');
  const [warrantlessItem, setWarrantlessItem] = useState<string>('');
  const [warrantlessModel, setWarrantlessModel] = useState<string>('');
  const [warrantlessError, setWarrantlessError] = useState<string>('');

  // Step 3: Defect States
  const [defectSubject, setDefectSubject] = useState<string>('');
  const [defectSubjectError, setDefectSubjectError] = useState<boolean>(false);
  const [defectDescription, setDefectDescription] = useState<string>('');
  const [defectSymptoms, setDefectSymptoms] = useState<string>('');
  const [repairPriority, setRepairPriority] = useState<'normal' | 'urgent' | 'very_urgent'>('normal');

  // Step 4: Physical & Accessories Checklist
  const [physicalCondition, setPhysicalCondition] = useState({
    impact: false,
    breakage: false,
    water: false,
    burn: false,
    tampered: false,
    sealBroken: false,
    scratches: false,
    perfect: false
  });
  const [physicalConditionNotes, setPhysicalConditionNotes] = useState<string>('');

  const [accessoriesList, setAccessoriesList] = useState<Array<{ id: string; label: string; checked: boolean; isCustom?: boolean }>>([
    { id: 'box', label: 'جعبه', checked: false },
    { id: 'charger', label: 'شارژر', checked: false },
    { id: 'cable', label: 'کابل', checked: false },
    { id: 'adapter', label: 'آداپتور', checked: false },
    { id: 'none', label: 'بدون لوازم همراه', checked: false },
    { id: 'other', label: 'سایر', checked: false }
  ]);
  const [customAccessoryInput, setCustomAccessoryInput] = useState<string>('');
  const [otherAccessoryInput, setOtherAccessoryInput] = useState<string>('');

  // Step 5: Photos & Final Submission
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Receipt State (After Submission)
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [receiptType, setReceiptType] = useState<'thermal' | 'official'>('official');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Pre-configured tags for quick entry of defect subjects
  const defectPresets = [
    'خاموشی کامل دستگاه',
    'روشن می‌شود ولی تصویر ندارد',
    'اتصال کوتاه در خط تغذیه',
    'خرابی فن و داغ شدن شدید',
    'عدم شناسایی در سیستم',
    'آسیب فیزیکی برد الکترونیکی',
    'بوق ممتد خطا در استارت آپ',
    'خروجی نامتعادل ولتاژ'
  ];

  // Helper to show temporary toast notification
  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper: Persial Expiry Status Calculator
  const getWarrantyInfo = (item: WarrantyItem | null) => {
    const parsePersianDate = (dateStr: string) => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const normalized = dateStr.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
      const match = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (!match) return null;
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      return { year, month, day };
    };

    const persianToDays = (year: number, month: number, day: number): number => {
      let days = year * 365 + Math.floor((year + 2) / 4);
      for (let m = 1; m < month; m++) {
        if (m <= 6) {
          days += 31;
        } else if (m <= 11) {
          days += 30;
        } else {
          days += 29;
        }
      }
      days += day;
      return days;
    };

    const addMonthsToPersianDate = (year: number, month: number, day: number, monthsToAdd: number) => {
      let newMonth = month + monthsToAdd;
      let newYear = year;
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      while (newMonth < 1) {
        newMonth += 12;
        newYear -= 1;
      }
      let maxDays = 30;
      if (newMonth <= 6) maxDays = 31;
      else if (newMonth === 12) maxDays = 29;
      
      const newDay = Math.min(day, maxDays);
      return { year: newYear, month: newMonth, day: newDay };
    };

    if (!item) return { status: 'none', label: 'نامشخص', color: 'text-slate-500 bg-slate-100 border-slate-200', remaining: 'نامشخص' };
    if (item.expiryDate === 'بدون گارانتی' || item.expiryDate === 'فاقد گارانتی') {
      return { 
        status: 'none', 
        label: 'فاقد گارانتی (تعمیرات آزاد)', 
        color: 'text-rose-600 bg-rose-50 border-rose-200/50', 
        remaining: 'فاقد مهلت گارانتی' 
      };
    }

    try {
      const regDate = parsePersianDate(item.registeredAt);
      if (!regDate) {
        return { 
          status: 'incomplete', 
          label: 'اطلاعات ناقص', 
          color: 'text-amber-600 bg-amber-50 border-amber-200/50', 
          remaining: 'اطلاعات گارانتی ناقص است' 
        };
      }

      let durationMonths: number | null = null;
      
      // Try to find matching product in products
      const matchingProduct = products && Array.isArray(products) 
        ? products.find(p => {
            const itemNameUpper = (item.itemName || '').trim().toUpperCase();
            const modelUpper = (p.model || '').trim().toUpperCase();
            const nameUpper = (p.name || '').trim().toUpperCase();
            return (
              itemNameUpper === modelUpper ||
              itemNameUpper === nameUpper ||
              itemNameUpper.includes(modelUpper) ||
              itemNameUpper.includes(nameUpper) ||
              modelUpper.includes(itemNameUpper) ||
              nameUpper.includes(itemNameUpper)
            );
          })
        : null;

      if (matchingProduct && matchingProduct.warrantyDuration) {
        durationMonths = parseInt(matchingProduct.warrantyDuration);
      } else {
        // If not found in products, try to calculate from expiryDate and registeredAt
        const expDate = parsePersianDate(item.expiryDate);
        if (expDate) {
          durationMonths = (expDate.year - regDate.year) * 12 + (expDate.month - regDate.month);
        }
      }

      if (durationMonths === null || isNaN(durationMonths)) {
        return { 
          status: 'incomplete', 
          label: 'اطلاعات ناقص', 
          color: 'text-amber-600 bg-amber-50 border-amber-200/50', 
          remaining: 'اطلاعات گارانتی ناقص است' 
        };
      }

      // Calculate final expiry date
      const expiryDateObj = addMonthsToPersianDate(regDate.year, regDate.month, regDate.day, durationMonths);

      // Today's simulated date in Persian calendar: 1405/04/07
      const curYear = 1405;
      const curMonth = 4;
      const curDay = 7;

      const todayDays = persianToDays(curYear, curMonth, curDay);
      const expiryDays = persianToDays(expiryDateObj.year, expiryDateObj.month, expiryDateObj.day);
      const diffDays = expiryDays - todayDays;

      if (diffDays < 0) {
        return { 
          status: 'expired', 
          label: 'گارانتی منقضی شده', 
          color: 'text-rose-600 bg-rose-50 border-rose-200/50', 
          remaining: `${Math.abs(diffDays)} روز از پایان گارانتی گذشته است` 
        };
      } else if (diffDays === 0) {
        return { 
          status: 'valid', 
          label: 'گارانتی معتبر', 
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200/50', 
          remaining: `امروز آخرین روز گارانتی است` 
        };
      } else {
        return { 
          status: 'valid', 
          label: 'گارانتی معتبر', 
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200/50', 
          remaining: `${diffDays} روز باقیمانده` 
        };
      }
    } catch (e) {
      // fallback
    }

    return { 
      status: 'incomplete', 
      label: 'اطلاعات ناقص', 
      color: 'text-amber-600 bg-amber-50 border-amber-200/50', 
      remaining: 'اطلاعات گارانتی ناقص است' 
    };
  };

  // Step 1 Check & Search Device Serial
  const handleSearchDevice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!serialNumberInput.trim()) {
      showToast('لطفاً شماره سریال را وارد کنید.', 'info');
      return;
    }

    if (serialNumberInput.length !== 4 && serialNumberInput.length !== 5) {
      showToast('طول شماره سریال باید ۴ یا ۵ رقم باشد.', 'info');
      return;
    }

    const query = `${selectedPrefix}-${serialNumberInput}`.trim().toUpperCase();
    const found = warrantyDb.find(item => item.serial.toUpperCase() === query);

    if (found) {
      setFoundItem(found);
      setIsWarrantless(false);
      setSearchState('found');
      setStep(2);
      showToast('دستگاه در سامانه ردیابی گارانتی پیدا شد.', 'success');
    } else {
      setFoundItem(null);
      setSearchState('not_found');
    }
  };

  // Select "پذیرش بدون گارانتی" (Proceed as warrantless repair)
  const handleProceedWarrantless = () => {
    setIsWarrantless(true);
    // Pre-fill some fields with default placeholder data for speed
    setWarrantlessItem('');
    setWarrantlessModel('');
    setWarrantlessName('');
    setWarrantlessPhone('');
  };

  // Submit manual warrantless details to proceed to step 2
  const handleWarrantlessFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warrantlessName.trim() || !warrantlessPhone.trim() || !warrantlessItem.trim()) {
      setWarrantlessError('لطفاً فیلدهای ستاره‌دار را تکمیل کنید.');
      return;
    }

    setWarrantlessError('');
    const mockItem: WarrantyItem = {
      serial: serialInput.trim().toUpperCase() || 'W-NON-G-' + Math.floor(1000 + Math.random() * 9000),
      itemName: warrantlessItem.trim(),
      customerName: warrantlessName.trim(),
      customerPhone: warrantlessPhone.trim(),
      defectType: 'تعمیرات آزاد خارج از گارانتی',
      status: 'pending',
      expiryDate: 'بدون گارانتی',
      registeredAt: '۱۴۰۵/۰۴/۰۷'
    };

    // Add to global customers list if not exists
    if (customers && Array.isArray(customers)) {
      const phoneExists = customers.some(c => c.phone === warrantlessPhone.trim());
      if (!phoneExists) {
        const newCust = {
          name: warrantlessName.trim(),
          phone: warrantlessPhone.trim(),
          type: 'person' as const,
          address: '',
          email: ''
        };
        setCustomers(prev => [...prev, newCust]);
      }
    }

    setFoundItem(mockItem);
    setStep(2);
    showToast('اطلاعات اولیه بصورت بدون گارانتی ثبت شد.', 'info');
  };

  // Handle Scanning Simulation
  const handleSimulateScan = (scannedSerial: string) => {
    setSerialInput(scannedSerial);
    setIsScanning(false);
    
    // Auto trigger search on simulated value
    const found = warrantyDb.find(item => item.serial.toUpperCase() === scannedSerial.toUpperCase());
    if (found) {
      setFoundItem(found);
      setIsWarrantless(false);
      setSearchState('found');
      setStep(2);
      showToast(`سریال ${scannedSerial} با موفقیت اسکن شد.`, 'success');
    } else {
      setFoundItem(null);
      setSearchState('not_found');
    }
  };

  // Simulate Random Barcode Scan (Picks from DB)
  const handleRandomScan = () => {
    if (warrantyDb.length > 0) {
      const randIdx = Math.floor(Math.random() * warrantyDb.length);
      const chosen = warrantyDb[randIdx].serial;
      handleSimulateScan(chosen);
    } else {
      handleSimulateScan('W-9082');
    }
  };

  // Physical Condition Change helper
  const handlePhysicalConditionChange = (key: keyof typeof physicalCondition) => {
    setPhysicalCondition(prev => {
      const updated = { ...prev };
      if (key === 'perfect') {
        const nextValue = !prev.perfect;
        if (nextValue) {
          // If "No physical issue" is selected, turn off all others
          Object.keys(updated).forEach(k => {
            updated[k as keyof typeof physicalCondition] = k === 'perfect';
          });
        } else {
          updated.perfect = false;
        }
      } else {
        const nextValue = !prev[key];
        updated[key] = nextValue;
        if (nextValue) {
          // If any issue is selected, turn off "No physical issue"
          updated.perfect = false;
        }
      }
      return updated;
    });
  };

  // Accessories checklist change helper
  const toggleAccessoryChecked = (id: string) => {
    setAccessoriesList(prev => {
      return prev.map(item => {
        if (id === 'none') {
          if (item.id === 'none') {
            return { ...item, checked: !item.checked };
          } else {
            return { ...item, checked: false };
          }
        } else {
          if (item.id === id) {
            return { ...item, checked: !item.checked };
          } else if (item.id === 'none') {
            return { ...item, checked: false };
          }
          return item;
        }
      });
    });
  };

  const addCustomAccessory = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (accessoriesList.some(item => item.label.toLowerCase() === trimmed.toLowerCase())) {
      showToast('این وسیله قبلاً اضافه شده است.', 'info');
      return;
    }
    const newId = 'custom_' + Date.now();
    setAccessoriesList(prev => {
      const cleaned = prev.map(item => item.id === 'none' ? { ...item, checked: false } : item);
      return [
        ...cleaned,
        { id: newId, label: trimmed, checked: true, isCustom: true }
      ];
    });
    showToast(`«${trimmed}» به لوازم همراه اضافه شد.`, 'success');
  };

  const removeCustomAccessory = (id: string) => {
    setAccessoriesList(prev => prev.filter(item => item.id !== id));
  };

  // Camera capture controls
  const startCamera = async () => {
    setIsCapturing(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setIsCapturing(false);
      showToast('خطا در دسترسی به دوربین! لطفاً تصویر را بارگذاری کرده یا از شبیه‌ساز استفاده کنید.', 'info');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotos(prev => [...prev, dataUrl]);
        stopCamera();
        showToast('تصویر دستگاه با موفقیت ثبت شد.', 'success');
      }
    } else {
      // Simulate snapshot in case browser device stream is sandboxed
      simulateAddPhoto();
    }
  };

  const simulateAddPhoto = () => {
    // Elegant demo photos of electronics parts
    const demoPhotos = [
      'https://images.unsplash.com/photo-1591405351990-4726e33df58a?w=400&auto=format&fit=crop&q=60', // microchip board
      'https://images.unsplash.com/photo-1601524909162-be87252be298?w=400&auto=format&fit=crop&q=60', // repair desk
      'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&auto=format&fit=crop&q=60'  // oscilloscope screen
    ];
    const chosen = demoPhotos[Math.floor(Math.random() * demoPhotos.length)] + "&sig=" + Math.random().toString(36).substring(7);
    setPhotos(prev => [...prev, chosen]);
    showToast('تصویر نمونه قطعه الکترونیکی بارگذاری شد.', 'info');
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    showToast('تصویر فیزیکی از لیست حذف شد.', 'info');
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setPhotos(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
      showToast('تصاویر گالری با موفقیت بارگذاری شدند.', 'success');
    }
  };

  // Final submit handler for registering the claims intake
  const handleSubmitReception = () => {
    if (!foundItem) return;

    // Compile physical conditions list
    const conditionsList: string[] = [];
    if (physicalCondition.impact) conditionsList.push('ضربه دارد');
    if (physicalCondition.breakage) conditionsList.push('شکستگی');
    if (physicalCondition.water) conditionsList.push('آب‌خوردگی');
    if (physicalCondition.burn) conditionsList.push('جای سوختگی');
    if (physicalCondition.tampered) conditionsList.push('دستکاری شده');
    if (physicalCondition.sealBroken) conditionsList.push('پلمب باز شده');
    if (physicalCondition.scratches) conditionsList.push('خش زیاد');
    if (physicalCondition.perfect) conditionsList.push('بدون ایراد ظاهری');

    // Compile accessories list
    let finalAccessoriesList = [...accessoriesList];
    if (accessoriesList.find(item => item.id === 'other')?.checked && otherAccessoryInput.trim()) {
      const trimmed = otherAccessoryInput.trim();
      if (!finalAccessoriesList.some(item => item.label.toLowerCase() === trimmed.toLowerCase())) {
        const newId = 'custom_' + Date.now();
        finalAccessoriesList.push({ id: newId, label: trimmed, checked: true, isCustom: true });
      }
    }
    const accList: string[] = finalAccessoriesList
      .filter(item => item.checked && item.id !== 'other')
      .map(item => item.label);

    // Check if DEC-144540 already exists, if not use it. If yes, generate or increment.
    const isIntakeTaken = (no: string) => warrantyDb.some(item => item.intakeNo === no);
    let uniqueIntakeNo = 'DEC-144540';
    if (isIntakeTaken(uniqueIntakeNo)) {
      uniqueIntakeNo = 'DEC-' + Math.floor(144541 + Math.random() * 1000);
    }
    const dateStr = '۱۴۰۵/۰۴/۰۷'; // simulated today

    // Create the final receipt database record
    const updatedRecord: WarrantyItem = {
      serial: foundItem.serial.toUpperCase(),
      itemName: foundItem.itemName,
      customerName: foundItem.customerName,
      customerPhone: foundItem.customerPhone,
      defectType: defectSubject || 'شرح خرابی نامشخص',
      status: 'pending', // initial repair queue intake status
      expiryDate: foundItem.expiryDate,
      registeredAt: `امروز (${dateStr})`,
      photoUrl: photos[0] || undefined,
      statusNotes: `[عیب اصلی]: ${defectDescription || 'ثبت نشده'} - [وضعیت فیزیکی]: ${conditionsList.join(', ') || 'ثبت نشده'} ${physicalConditionNotes ? `(${physicalConditionNotes})` : ''} - [اقلام همراه]: ${accList.join(', ') || 'هیچ‌کدام'}`,
      technicianName: userRole === 'technician' ? 'تعمیرگاه ۱' : undefined,
      intakeNo: uniqueIntakeNo,
      priority: repairPriority === 'normal' ? 'عادی' : repairPriority === 'urgent' ? 'فوری' : 'خیلی فوری',
      model: foundItem.itemName.includes('-') ? foundItem.itemName.split('-')[1] : 'DEC-CH-12',
      warrantyStatus: getWarrantyInfo(foundItem).label,
      waitingDaysCount: 1,
      defectDescription: defectDescription || 'بدون توضیحات تکمیلی',
      defectSubject: defectSubject,
      accessories: accList,
      conditions: conditionsList,
      isRealReception: true
    };

    // Update global list (update existing record in-place to avoid duplication, or prepend if new)
    const exists = warrantyDb.some(item => item.serial.toUpperCase() === foundItem.serial.toUpperCase());
    if (exists) {
      setWarrantyDb(prev => prev.map(item => item.serial.toUpperCase() === foundItem.serial.toUpperCase() ? updatedRecord : item));
    } else {
      setWarrantyDb([updatedRecord, ...warrantyDb]);
    }

    // Store receipt data to display
    setReceiptData({
      intakeNo: uniqueIntakeNo,
      date: dateStr,
      customerName: foundItem.customerName,
      customerPhone: foundItem.customerPhone,
      itemName: foundItem.itemName,
      model: foundItem.itemName.includes('-') ? foundItem.itemName.split('-')[1] : 'DEC-CH-12',
      serial: foundItem.serial,
      defectSubject: defectSubject,
      defectDescription: defectDescription || 'بدون توضیحات تکمیلی',
      symptoms: defectSymptoms || 'ثبت نشده',
      priority: repairPriority,
      conditions: conditionsList,
      accessories: accList,
      warrantyStatus: getWarrantyInfo(foundItem).label,
      physicalConditionNotes: physicalConditionNotes
    });

    showToast('پذیرش قطعه با موفقیت در سامانه ثبت گردید.', 'success');
  };

  // Reset entire intake process to register a new device intake
  const handleResetIntake = () => {
    setStep(1);
    setSerialInput('');
    setSelectedPrefix(extractedPrefixes[0] || 'DEC');
    setSerialNumberInput('');
    setSearchState('idle');
    setFoundItem(null);
    setIsWarrantless(false);
    setDefectSubject('');
    setDefectDescription('');
    setDefectSymptoms('');
    setRepairPriority('normal');
    setPhysicalCondition({
      impact: false,
      breakage: false,
      water: false,
      burn: false,
      tampered: false,
      sealBroken: false,
      scratches: false,
      perfect: false
    });
    setPhysicalConditionNotes('');
    setAccessoriesList([
      { id: 'box', label: 'جعبه', checked: false },
      { id: 'charger', label: 'شارژر', checked: false },
      { id: 'cable', label: 'کابل', checked: false },
      { id: 'adapter', label: 'آداپتور', checked: false },
      { id: 'none', label: 'بدون لوازم همراه', checked: false },
      { id: 'other', label: 'سایر', checked: false }
    ]);
    setCustomAccessoryInput('');
    setOtherAccessoryInput('');
    setPhotos([]);
    setReceiptData(null);
  };

  // Simulated redirect to P005 (Sale and Activate warranty)
  const handleRegisterSaleRedirect = () => {
    if (onRedirectToSale) {
      onRedirectToSale(serialInput);
    } else {
      // fallback if no binder
      setActiveTab('register_sale');
    }
    showToast('در حال انتقال به فرم فاکتور فروش...', 'info');
  };

  // Render step label checks
  const stepsMeta = [
    { label: 'شناسایی دستگاه', num: 1 },
    { label: 'اطلاعات دستگاه', num: 2 },
    { label: 'خرابی', num: 3 },
    { label: 'وضعیت و لوازم', num: 4 },
    { label: 'ثبت پذیرش', num: 5 }
  ];

  // If receipt is ready, show receipt screen instead of form
  if (receiptData) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-right p-1" dir="rtl">
        {/* Toast Notification inside view */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900 text-white text-xs font-black px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg text-center"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{notification.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <h4 className="text-xs font-black text-emerald-950">پذیرش دستگاه با موفقیت انجام شد!</h4>
            <p className="text-[10px] text-emerald-700 font-bold mt-1">سند فنی رسید صادر شده و قطعه به کارتابل تکنسین‌ها ارجاع گردید.</p>
          </div>
        </div>

        {/* PRINTABLE THERMAL RECEIPT CARD */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4 border-t-8 border-t-blue-600 relative overflow-hidden">
          {/* Watermark logo decoration */}
          <div className="absolute -top-10 -left-10 text-slate-100/50 pointer-events-none select-none">
            <PlusCircle className="w-40 h-40" />
          </div>

          <div className="border-b border-dashed border-slate-200 pb-4 text-center space-y-1">
            <span className="text-[10px] font-black text-slate-400 block tracking-widest">DIACO ELECTRONIX</span>
            <h3 className="text-sm font-black text-slate-800">رسید پذیرش خدمات پس از فروش دیاکو</h3>
            <div className="flex justify-center items-center gap-1.5 pt-1.5">
              <span className="text-[10px] text-slate-400 font-bold">شماره پذیرش:</span>
              <span className="text-xs font-black font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded">{receiptData.intakeNo}</span>
            </div>
          </div>

          <div className="space-y-3.5 text-xs text-slate-700">
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">نام طرف حساب:</span>
                <span className="font-black text-slate-900">{receiptData.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">تلفن همراه:</span>
                <span className="font-black text-slate-900 font-mono" dir="ltr">{receiptData.customerPhone}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 font-bold block text-[10px]">نام کالا و برند:</span>
                <span className="font-black text-slate-900">{receiptData.itemName}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 font-bold block text-[10px]">شماره سریال:</span>
                <span className="font-black text-slate-900 font-mono block truncate" dir="ltr">{receiptData.serial}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 font-bold block text-[10px]">تاریخ پذیرش:</span>
                <span className="font-black text-slate-900 font-mono">{receiptData.date}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 font-bold block text-[10px]">وضعیت گارانتی:</span>
                <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block text-[11px] font-black">{receiptData.warrantyStatus}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-black text-[10px]">ایراد و عیب گزارش شده:</span>
              <p className="font-black text-rose-700 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/30 text-xs leading-relaxed">
                {receiptData.defectSubject} — {receiptData.defectDescription}
              </p>
            </div>

            {receiptData.accessories.length > 0 && (
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">لوازم همراه پذیرش شده:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {receiptData.accessories.map((acc: string, idx: number) => (
                    <span key={idx} className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-[10px] font-black">
                      ✓ {acc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {receiptData.conditions.length > 0 && (
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">وضعیت فیزیکی و ظاهری قطعه:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {receiptData.conditions.map((cond: string, idx: number) => {
                    const isPerfect = cond === 'بدون ایراد ظاهری';
                    return (
                      <span
                        key={idx}
                        className={
                          isPerfect
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-1 rounded text-[10px] font-black"
                            : "bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-1 rounded text-[10px] font-black"
                        }
                      >
                        {isPerfect ? '✓' : '⚠'} {cond}
                      </span>
                    );
                  })}
                </div>
                {receiptData.physicalConditionNotes && (
                  <p className="text-[10px] text-slate-500 font-bold mt-1.5">توضیحات ظاهر: {receiptData.physicalConditionNotes}</p>
                )}
              </div>
            )}

            {/* QR CODE & VERIFICATION BARCODE */}
            <div className="pt-4 border-t border-slate-100 flex flex-col items-center justify-center space-y-2">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                {/* Visual mock QR Code vector layout */}
                <div className="w-24 h-24 bg-white flex flex-col justify-between p-1.5 relative">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-4 border-slate-900 rounded-xs"></div>
                    <div className="w-6 h-6 border-4 border-slate-900 rounded-xs"></div>
                  </div>
                  {/* Mock pattern details */}
                  <div className="absolute inset-4 grid grid-cols-4 gap-0.5 p-1 select-none pointer-events-none">
                    <div className="bg-slate-900"></div><div className="bg-white"></div><div className="bg-slate-900"></div><div className="bg-slate-900"></div>
                    <div className="bg-white"></div><div className="bg-slate-900"></div><div className="bg-white"></div><div className="bg-white"></div>
                    <div className="bg-slate-900"></div><div className="bg-white"></div><div className="bg-slate-900"></div><div className="bg-slate-900"></div>
                    <div className="bg-slate-900"></div><div className="bg-slate-900"></div><div className="bg-white"></div><div className="bg-slate-900"></div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="w-6 h-6 border-4 border-slate-900 rounded-xs"></div>
                    <div className="w-3 h-3 bg-slate-900 rounded-xs"></div>
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">SCAN TO TRACK REPAIR STATE</span>
            </div>
          </div>
        </div>

        {/* RECEIPT ACTIONS & MESSAGING CHANNELS */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowPrintModal(true)}
            className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-100 flex flex-col items-center justify-center gap-1"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ رسید</span>
          </button>

          <button
            onClick={() => showToast('پیامک رسید پذیرش با موفقیت به شماره تلفن طرف حساب ارسال شد.', 'success')}
            className="py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-amber-100 flex flex-col items-center justify-center gap-1"
          >
            <Smartphone className="w-4 h-4" />
            <span>ارسال پیامک</span>
          </button>

          <button
            onClick={() => showToast('رسید با امضای دیجیتال به واتساپ طرف حساب ارسال گردید.', 'success')}
            className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-100 flex flex-col items-center justify-center gap-1"
          >
            <Share2 className="w-4 h-4" />
            <span>ارسال واتساپ</span>
          </button>
        </div>

        {/* PRIMARY ACTIONS */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleResetIntake}
            className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl transition-colors cursor-pointer text-center"
          >
            ثبت پذیرش جدید
          </button>
          
          <button
            onClick={() => {
              setQueueFilter('pending');
              setActiveTab('queue');
            }}
            className="py-3 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl transition-colors cursor-pointer text-center"
          >
            مشاهده کارتابل پذیرش‌ها
          </button>
        </div>

        {/* THERMAL & OFFICIAL PRINT DIALOG MODAL SIMULATION */}
        <AnimatePresence>
          {showPrintModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowPrintModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className={`bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-3xl w-full overflow-hidden shadow-2xl p-5 md:p-6 space-y-4.5 transition-all duration-300 ${
                  receiptType === 'official' ? 'max-w-2xl' : 'max-w-md'
                }`}
              >
                {/* Header Row */}
                <div className="flex justify-between items-center border-b border-zinc-200/80 pb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Printer className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="text-right">
                      <h4 className="text-xs font-black text-zinc-900">پیش‌نمایش صدور فاکتور و رسید پذیرش</h4>
                      <p className="text-[9px] text-zinc-400 font-bold mt-0.5">فرمت چاپی مورد نظر خود را برای چاپگرهای غرفه انتخاب کنید</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPrintModal(false)} 
                    className="p-1.5 hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Format Switcher Tabs */}
                <div className="flex bg-zinc-200/50 p-1 rounded-2xl border border-zinc-300/20">
                  <button
                    type="button"
                    onClick={() => setReceiptType('official')}
                    className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      receiptType === 'official'
                        ? 'bg-white text-blue-700 shadow-sm border border-zinc-200/30 font-black'
                        : 'text-zinc-500 hover:text-zinc-800 font-bold'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>برگه رسمی آ۵ (مناسب بایگانی و طرف حساب)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptType('thermal')}
                    className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      receiptType === 'thermal'
                        ? 'bg-white text-blue-700 shadow-sm border border-zinc-200/30 font-black'
                        : 'text-zinc-500 hover:text-zinc-800 font-bold'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>فیش حرارتی ۸۰mm (سریع و کم‌هزینه)</span>
                  </button>
                </div>

                {/* FORMAT RENDER AREA */}
                {receiptType === 'official' ? (
                  /* 1. OFFICIAL RECEPTION INVOICE (A5/A4 Ratio Look) */
                  <div className="bg-white border border-zinc-300/80 rounded-2xl p-5 space-y-4 shadow-inner max-h-[460px] overflow-y-auto text-right" id="official-receipt-print-area">
                    {/* Invoice Top Title Block */}
                    <div className="border border-zinc-900/10 bg-slate-50/50 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-3">
                      {/* Brand Logo & Slogan */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-sm shrink-0">
                          <PlusCircle className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-blue-600 block leading-tight">DIACO ELECTRONIX</span>
                          <span className="text-[9px] text-zinc-400 font-bold">خدمات پس از فروش دیاکو</span>
                        </div>
                      </div>

                      {/* Header Main Text */}
                      <div className="text-center">
                        <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wide">برگه رسید پذیرش و فاکتور خدمات</h3>
                        <p className="text-[9px] text-zinc-400 font-black mt-0.5">کارگاه مرکزی تعمیرات سخت‌افزار</p>
                      </div>

                      {/* Invoice Serial Details */}
                      <div className="text-[9px] text-zinc-600 space-y-1 font-bold bg-white px-3 py-2 rounded-xl border border-zinc-200/60">
                        <div className="flex justify-between gap-4">
                          <span className="text-zinc-400">شماره رسید پذیرش:</span>
                          <span className="font-mono text-zinc-900 font-black text-xs">{receiptData.intakeNo}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-zinc-100 pt-1">
                          <span className="text-zinc-400">تاریخ ثبت:</span>
                          <span className="font-mono text-zinc-900">{receiptData.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info (مشخصات متقاضی) */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-zinc-400 block px-1">۱. مشخصات طرف حساب و متقاضی خدمات:</span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 bg-slate-50/30 border border-slate-200/40 p-3 rounded-xl">
                        <div>
                          <span className="text-zinc-400 text-[9px] font-bold block">نام و نام خانوادگی:</span>
                          <span className="font-black text-zinc-900">{receiptData.customerName}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[9px] font-bold block">تلفن همراه متقاضی:</span>
                          <span className="font-black text-zinc-900 font-mono" dir="ltr">{receiptData.customerPhone}</span>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-zinc-400 text-[9px] font-bold block">آدرس تحویل/ارسال:</span>
                          <span className="font-bold text-zinc-700 text-[10px] block truncate">دفتر مرکزی خدمات دیاکو - بخش تحویل</span>
                        </div>
                      </div>
                    </div>

                    {/* Device Details (مشخصات فنی دستگاه) */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-zinc-400 block px-1">۲. مشخصات سخت‌افزاری و سریال قطعه:</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50/30 border border-slate-200/40 p-3 rounded-xl">
                        <div>
                          <span className="text-zinc-400 text-[9px] font-bold block">نام و رده کالا:</span>
                          <span className="font-black text-zinc-900 text-[11px]">{receiptData.itemName}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[9px] font-bold block">برند و مدل دستگاه:</span>
                          <span className="font-black text-zinc-900 text-[11px]">{receiptData.model || 'نامشخص'}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-zinc-400 text-[9px] font-bold block">شماره سریال انحصاری (S/N):</span>
                          <span className="font-black text-zinc-900 font-mono text-[10px] block truncate" dir="ltr">{receiptData.serial}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[9px] font-bold block">وضعیت گارانتی خدمات:</span>
                          <span className="font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] inline-block">{receiptData.warrantyStatus}</span>
                        </div>
                      </div>
                    </div>

                    {/* Technical details Grid (جزئیات عیب‌یابی و ملزومات) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-zinc-400 block px-1">۳. وضعیت عیب گزارش شده و شرح ایراد:</span>
                        <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-3 h-full min-h-24">
                          <span className="text-rose-900 font-black text-[11px] block">{receiptData.defectSubject}</span>
                          <p className="text-[10px] text-zinc-600 font-bold mt-1.5 leading-relaxed">{receiptData.defectDescription}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-zinc-400 block px-1">۴. وضعیت فیزیکی و لوازم همراه پذیرش شده:</span>
                        <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-3 space-y-2 h-full min-h-24">
                          <div>
                            <span className="text-zinc-400 text-[9px] font-bold block mb-1">لوازم همراه ثبت شده:</span>
                            <div className="flex flex-wrap gap-1">
                              {receiptData.accessories.map((acc: string, idx: number) => (
                                <span key={idx} className="bg-white border border-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                                  ✓ {acc}
                                </span>
                              ))}
                              {receiptData.accessories.length === 0 && <span className="text-[10px] font-bold text-zinc-400">بدون لوازم همراه</span>}
                            </div>
                          </div>
                          <div>
                            <span className="text-zinc-400 text-[9px] font-bold block mb-1">وضعیت ظاهری و بدنه:</span>
                            <div className="flex flex-wrap gap-1">
                              {receiptData.conditions.map((cond: string, idx: number) => {
                                const isPerfect = cond === 'بدون ایراد ظاهری';
                                return (
                                  <span
                                    key={idx}
                                    className={
                                      isPerfect
                                        ? "bg-emerald-100/50 text-emerald-800 px-1.5 py-0.5 rounded text-[9px] font-black"
                                        : "bg-amber-100/50 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-black"
                                    }
                                  >
                                    {isPerfect ? '✓' : '⚠'} {cond}
                                  </span>
                                );
                              })}
                              {receiptData.conditions.length === 0 && <span className="text-[10px] font-bold text-zinc-400">سالم و بدون ایراد ظاهری</span>}
                            </div>
                            {receiptData.physicalConditionNotes && (
                              <p className="text-[9px] text-zinc-500 font-bold mt-1.5 border-t border-amber-200/30 pt-1">توضیحات بدنه: {receiptData.physicalConditionNotes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* QR Code and Barcode Row */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-dashed border-zinc-200 pt-4">
                      {/* CSS Barcode */}
                      <div className="flex flex-col items-center justify-center p-1.5 border border-zinc-200/50 bg-slate-50/50 rounded-xl shrink-0">
                        <div className="flex gap-0.5 items-center justify-center h-8 px-4">
                          <div className="w-1 h-full bg-slate-900"></div>
                          <div className="w-[2px] h-full bg-slate-900"></div>
                          <div className="w-0.5 h-full bg-slate-900"></div>
                          <div className="w-1.5 h-full bg-slate-900"></div>
                          <div className="w-[1px] h-full bg-slate-900"></div>
                          <div className="w-0.5 h-full bg-slate-900"></div>
                          <div className="w-1 h-full bg-slate-900"></div>
                          <div className="w-[2px] h-full bg-slate-900"></div>
                          <div className="w-1.5 h-full bg-slate-900"></div>
                          <div className="w-0.5 h-full bg-slate-900"></div>
                          <div className="w-1.5 h-full bg-slate-900"></div>
                          <div className="w-[3px] h-full bg-slate-900"></div>
                          <div className="w-0.5 h-full bg-slate-900"></div>
                        </div>
                        <span className="text-[8px] font-mono tracking-widest text-slate-600 font-bold mt-1">{receiptData.intakeNo}</span>
                      </div>

                      {/* Rules Terms */}
                      <div className="flex-1 text-[8.5px] leading-relaxed text-zinc-400 font-bold pr-2">
                        <p>۱. تحویل قطعه صرفاً در قبال ارایه این فیش رسمی پذیرش سخت‌افزار خواهد بود.</p>
                        <p>۲. مسئولیت بک‌آپ‌گیری از داده‌ها به عهده طرف حساب بوده و شرکت تعهدی در قبال بازیابی اطلاعات ندارد.</p>
                        <p>۳. مدت زمان تحویل ۳۰ روز کاری پس از عیب‌یابی اولیه می‌باشد.</p>
                      </div>

                      {/* Visual Mock Stamp and Signatures */}
                      <div className="flex gap-4 shrink-0">
                        <div className="text-center w-24 h-16 border border-dashed border-blue-400/50 rounded-xl relative flex flex-col items-center justify-center bg-blue-50/10">
                          <span className="text-[8px] font-bold text-blue-400/80">مهر و امضای کارگاه</span>
                          <div className="absolute inset-1.5 border border-dashed border-blue-300/40 rounded-lg pointer-events-none flex items-center justify-center rotate-6">
                            <span className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest font-mono">APPROVED</span>
                          </div>
                        </div>
                        <div className="text-center w-24 h-16 border border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center">
                          <span className="text-[8px] font-bold text-zinc-400">امضای طرف حساب</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. THERMAL ROLL RECEIPT (80mm) */
                  <div className="bg-white border border-zinc-300/80 p-5 font-mono text-[10px] space-y-3.5 leading-normal shadow-inner max-h-96 overflow-y-auto text-right" id="thermal-receipt-print-area">
                    <div className="text-center space-y-1 border-b border-dashed border-zinc-300 pb-2.5">
                      <p className="font-black text-xs">DIACO ELECTRONIX</p>
                      <p className="text-[9px] font-bold">دیاکو الکترونیک - خدمات فنی سخت‌افزار</p>
                      <p className="text-[9px] font-bold">تلفن پشتیبانی: ۰۲۱-۸۸۹۹۲۲۱۱</p>
                      <p className="text-[8px] text-zinc-500">{receiptData.date} - {new Date().toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>

                    <div className="space-y-2 border-b border-dashed border-zinc-300 pb-2.5 font-bold text-zinc-800">
                      <div className="flex justify-between">
                        <span>پذیرش کارگاه:</span>
                        <span className="font-black text-[11px]">{receiptData.intakeNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>نوع دستگاه:</span>
                        <span>{receiptData.itemName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مدل/برند:</span>
                        <span>{receiptData.model || 'نامشخص'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>شماره سریال:</span>
                        <span className="font-mono text-[9px]">{receiptData.serial}</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-100 pt-1 mt-1">
                        <span>طرف حساب:</span>
                        <span>{receiptData.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>شماره موبایل:</span>
                        <span className="font-mono">{receiptData.customerPhone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>گارانتی:</span>
                        <span className="text-blue-600 font-black">{receiptData.warrantyStatus}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-2.5">
                      <p className="font-black">موضوع خرابی و ایراد:</p>
                      <p className="bg-slate-50 p-2 rounded text-[9.5px] font-bold text-rose-700">{receiptData.defectSubject}</p>
                      <p className="text-[9px] text-zinc-500">شرح: {receiptData.defectDescription}</p>
                    </div>

                    <div className="space-y-1 border-b border-dashed border-zinc-300 pb-2.5">
                      <p className="font-black">لوازم همراه پذیرش شده:</p>
                      <p className="font-bold text-zinc-700">{receiptData.accessories.join(' + ') || 'بدون لوازم همراه'}</p>
                    </div>

                    <div className="space-y-1 border-b border-dashed border-zinc-300 pb-2.5">
                      <p className="font-black">وضعیت فیزیکی بدنه:</p>
                      <p className="font-bold text-zinc-700">{receiptData.conditions.join(' / ') || 'سالم و بدون ایراد ظاهری'}</p>
                    </div>

                    <div className="text-center pt-2 space-y-2">
                      <p className="text-[8px] leading-relaxed text-zinc-400">تحویل قطعه صرفاً با ارائه این فیش مقدور خواهد بود.</p>
                      <p className="font-black text-[9px] text-zinc-400">--- با تشکر از انتخاب دیاکو ---</p>
                    </div>
                  </div>
                )}

                {/* Print Buttons & Action Bar */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1.5">
                  <button
                    onClick={() => {
                      setShowPrintModal(false);
                      showToast(`دستور چاپ ${receiptType === 'official' ? 'فاکتور رسمی آ۵' : 'فیش حرارتی ۸۰mm'} با موفقیت به چاپگر ارسال شد.`, 'success');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-2xl transition-all cursor-pointer shadow-md shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>تایید و ارسال به چاپگر غرفه</span>
                  </button>

                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="py-3 px-5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  >
                    <span>چاپ مستقیم مرورگر</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4 text-right p-1" dir="rtl">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 inset-x-4 z-50 bg-slate-900 text-white text-xs font-black px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg text-center"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP WIZARD STEPS PROGRESS BAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
        {/* Dynamic Process Percentage and Line */}
        <div className="flex justify-between items-center text-xs">
          <span className="font-black text-slate-700">میزان پیشرفت ثبت پذیرش:</span>
          <span className="font-mono font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>{Math.round(((step - 1) / 4) * 100)}% ({step} از ۵)</span>
          </span>
        </div>
        
        {/* The Sleek Horizontal Progress Bar Track */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/30">
          <motion.div 
            className="h-full bg-gradient-to-l from-emerald-500 to-teal-400 rounded-full shadow-inner"
            initial={{ width: 0 }}
            animate={{ width: `${((step - 1) / 4) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* 5 step interactive nodes with labels and checks */}
        <div className="flex justify-between items-center relative pt-1.5">
          {/* Step connector line */}
          <div className="absolute top-4 inset-x-3 h-0.5 bg-slate-100/80 z-0"></div>
          {/* Active green progress filler */}
          <div 
            className="absolute top-4 right-3 h-0.5 bg-emerald-400 z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 4) * 100 - 2}%` }}
          ></div>

          {stepsMeta.map((s) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            
            return (
              <div key={s.num} className="flex flex-col items-center relative z-10 shrink-0">
                <button
                  type="button"
                  disabled={s.num > step} // Can only click previous/completed or current step
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                  }}
                  className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white shadow-xs border border-emerald-600' 
                      : isActive 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100 border border-blue-700 ring-4 ring-blue-50' 
                        : 'bg-white text-slate-400 border border-slate-200'
                  } ${s.num < step ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                >
                  {isCompleted ? (
                    <Check className="w-4.5 h-4.5 stroke-[3px]" />
                  ) : (
                    <span>{s.num}</span>
                  )}
                </button>
                <span className={`text-[8.5px] font-black mt-1.5 tracking-tighter ${
                  isActive ? 'text-blue-600 font-black' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FORM ACTIONS WRAPPER */}
      <AnimatePresence mode="wait">
        {/* STEP 1: IDENTIFY SERIAL */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <PlusCircle className="text-blue-600 w-4.5 h-4.5" />
                  <span>مرحله اول: شناسایی کالا در سیستم</span>
                </h3>
                <p className="text-[11px] text-slate-400">شماره سریال دستگاه را برای ردیابی پرونده گارانتی و اطلاعات فروش استعلام کنید.</p>
              </div>

              {/* SERIAL INPUT & SEARCH */}
              <form onSubmit={handleSearchDevice} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 block">شماره سریال دستگاه را وارد کنید</label>
                  <div className="flex items-center gap-2" dir="ltr">
                    {/* Prefix dropdown */}
                    <div className="relative w-1/3">
                      <select
                        value={selectedPrefix}
                        onChange={(e) => {
                          setSelectedPrefix(e.target.value);
                          setSearchState('idle');
                        }}
                        className="w-full h-11 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-center text-xs font-black outline-none transition-all appearance-none cursor-pointer"
                      >
                        {extractedPrefixes.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[9px] select-none">
                        ▼
                      </div>
                    </div>

                    <span className="text-slate-400 font-bold select-none text-sm">-</span>

                    {/* Numeric code input */}
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      required
                      value={serialNumberInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length <= 5) {
                          setSerialNumberInput(val);
                          setSearchState('idle');
                        }
                      }}
                      placeholder="۵۰۰۰ یا ۱۲۵۰۰"
                      className="flex-1 h-11 px-4 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-center text-xs font-black outline-none transition-all font-mono tracking-wider"
                    />
                  </div>



                  {serialNumberInput && serialNumberInput.length !== 4 && serialNumberInput.length !== 5 && (
                    <p className="text-[10px] text-rose-600 font-bold text-right" dir="rtl">
                      ⚠️ طول بخش عددی سریال باید ۴ یا ۵ رقم باشد (در حال حاضر: {serialNumberInput.length} رقم).
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="submit"
                    className="py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>جستجوی دستگاه</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsScanning(true)}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>اسکن با دوربین</span>
                  </button>
                </div>
              </form>

              {/* SEARCH STATES FEEDBACKS */}
              {searchState === 'not_found' && !isWarrantless && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-rose-50 border border-rose-100/80 rounded-xl p-3.5 space-y-3.5 text-right"
                >
                  <div className="flex items-start gap-2 text-rose-800">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-black block">این شماره سریال در سامانه ثبت نشده است.</span>
                      <p className="text-[10px] text-rose-600 font-bold leading-normal">برای پذیرش این کالا، می‌توانید فرآیند فروش را فعال کنید یا مستقیماً قطعه را بدون گارانتی (تعمیرات آزاد کارگاهی) پذیرش نمایید.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRegisterSaleRedirect}
                      className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>۱. فاکتور فروش</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedWarrantless}
                      className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>۲. پذیرش بدون گارانتی</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* INTEGRATED MANUAL FORM FOR WARRANTLESS CASE */}
            {isWarrantless && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3.5"
              >
                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                  <Info className="w-4.5 h-4.5 text-amber-500" />
                  <h4 className="text-xs font-black text-slate-800">فرم مشخصات کالا و طرف حساب (بدون گارانتی)</h4>
                </div>

                {warrantlessError && (
                  <div className="bg-rose-50 text-rose-700 text-[10px] font-black px-3 py-1.5 rounded-lg">
                    {warrantlessError}
                  </div>
                )}

                <form onSubmit={handleWarrantlessFormSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600">نام طرف حساب <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={warrantlessName}
                        onChange={(e) => setWarrantlessName(e.target.value)}
                        placeholder="مثال: اکبر علوی"
                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600">شماره تلفن همراه <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={warrantlessPhone}
                        onChange={(e) => setWarrantlessPhone(e.target.value)}
                        placeholder="09121112233"
                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold text-center font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600">نام کالا <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={warrantlessItem}
                        onChange={(e) => setWarrantlessItem(e.target.value)}
                        placeholder="مثال: شارژر صنعتی ۲۴ ولت"
                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600">مدل کالا</label>
                      <input
                        type="text"
                        value={warrantlessModel}
                        onChange={(e) => setWarrantlessModel(e.target.value)}
                        placeholder="DEC-2420-CH"
                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold text-center font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>تایید اطلاعات و شروع پذیرش</span>
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                  </button>
                </form>
              </motion.div>
            )}

            {/* BACKDROP CAMERA SCANNER SIMULATION */}
            <AnimatePresence>
              {isScanning && (
                <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-4" dir="rtl">
                  {/* Scanning HUD Header */}
                  <div className="flex justify-between items-center text-white pt-2">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-blue-400">اسکنر بارکد و کد QR دیاکو</h4>
                      <p className="text-[9px] text-slate-400">دوربین گوشی را روی بارکد محصول نگه دارید یا عکس آن را بارگذاری کنید</p>
                    </div>
                    <button
                      onClick={() => setIsScanning(false)}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* Scanning Target Box with Live Video */}
                  <div className="flex-1 flex flex-col items-center justify-center relative my-4 gap-4">
                    <div className="w-64 h-64 border-2 border-blue-500 rounded-3xl relative overflow-hidden flex items-center justify-center bg-black">
                      {receptionCameraStream && (
                        <video 
                          ref={receptionVideoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="absolute inset-0 w-full h-full object-cover z-0"
                        />
                      )}
                      
                      {/* Laser red animated bar */}
                      <div className="absolute inset-x-0 h-0.5 bg-rose-500 top-1/2 -translate-y-1/2 animate-bounce z-10 pointer-events-none"></div>
                      <span className="text-[9px] font-black text-blue-400 bg-slate-900/80 px-2 py-1 rounded z-10">
                        {receptionCameraStream ? 'در حال پویش زنده...' : 'درحال آماده‌سازی...'}
                      </span>
                    </div>

                    {/* Image File Uploader Option */}
                    <div className="w-64">
                      <label className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-blue-400 border border-slate-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors text-center">
                        <Upload className="w-3.5 h-3.5" />
                        <span>بارگذاری عکس بارکد یا QR</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const code = await scanImageFile(file);
                              if (code) {
                                playScanBeepSound();
                                handleSimulateScan(code);
                              } else {
                                alert("کد QR یا بارکدی در این تصویر خوانده نشد.");
                              }
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Laser corner markers */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+24px)] w-72 h-72 border border-white/15 rounded-[2.5rem] pointer-events-none"></div>
                  </div>

                  {/* Sandbox scanning helpers list */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
                    <span className="text-[10px] font-black text-amber-400 block uppercase tracking-wider text-center">راهنمای شبیه‌ساز گارانتی کارگاه</span>
                    <p className="text-[9.5px] text-slate-400 text-center leading-normal">برای تست سریع بدون دوربین، روی یکی از سریال‌های زیر کلیک کنید تا فرآیند اسکن فیزیکی فورا در کارگاه شبیه‌سازی شود:</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {warrantyDb.slice(0, 4).map((item, idx) => (
                        <button
                          key={`${item.serial}-${idx}`}
                          onClick={() => {
                            playScanBeepSound();
                            handleSimulateScan(item.serial);
                          }}
                          className="p-2 bg-slate-800 hover:bg-blue-900/40 hover:border-blue-500/50 text-[10px] font-black font-mono text-slate-200 border border-slate-700 rounded-xl transition-all cursor-pointer text-center"
                        >
                          📌 {item.serial} ({item.itemName.slice(0,10)}...)
                        </button>
                      ))}
                    </div>

                    <div className="pt-1.5 border-t border-slate-800 flex justify-center">
                      <button
                        onClick={() => {
                          playScanBeepSound();
                          handleRandomScan();
                        }}
                        className="py-1.5 px-4 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-lg cursor-pointer"
                      >
                        ⚡ شبیه‌سازی اسکن سریال تصادفی
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* STEP 2: SHOW SPECS & INFO (READONLY) */}
        {step === 2 && foundItem && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="text-emerald-600 w-4.5 h-4.5" />
                  <span>مرحله دوم: اطلاعات گارانتی و دستگاه</span>
                </h3>
                <p className="text-[11px] text-slate-400">این اطلاعات صرفاً جهت تایید فنی پرونده فروش لود شده و غیرقابل تغییر می‌باشند.</p>
              </div>

              {/* READ ONLY SPECS CARD */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-2xl p-4 space-y-3.5 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-bold block">طرف حساب</span>
                      <span className="text-xs font-black text-slate-900">{foundItem.customerName}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${getWarrantyInfo(foundItem).color}`}>
                    {getWarrantyInfo(foundItem).label}
                  </span>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-700 font-bold">
                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">شماره موبایل طرف حساب:</span>
                    <span className="font-black text-slate-900 font-mono" dir="ltr">{foundItem.customerPhone}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">نام کالا / دستگاه:</span>
                    <span className="font-black text-slate-900">{foundItem.itemName}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">مدل سخت‌افزار:</span>
                    <span className="font-black text-slate-900 font-mono">
                      {foundItem.itemName.includes('DEC') ? foundItem.itemName.slice(0, 15) : 'DEC-CH-X'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">شماره سریال انحصاری:</span>
                    <span className="font-black text-blue-600 font-mono tracking-wider" dir="ltr">{foundItem.serial}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">تاریخ فاکتور فروش اولیه:</span>
                    <span className="font-black text-slate-900 font-mono">{foundItem.registeredAt}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">مدت باقیمانده گارانتی:</span>
                    <span className="font-black text-slate-900">
                      {getWarrantyInfo(foundItem).remaining || 'فاقد مهلت گارانتی'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION COMMANDS */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors cursor-pointer"
                >
                  بازگشت
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>تایید مشخصات و ثبت خرابی</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: DEFECT INFO FORM */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <AlertCircle className="text-blue-600 w-4.5 h-4.5" />
                  <span>مرحله سوم: گزارش خرابی و عیوب دستگاه</span>
                </h3>
                <p className="text-[11px] text-slate-400">عیب دستگاه و اولویت تعمیر را بر اساس تذکر کارفرما پر کنید.</p>
              </div>

              <div className="space-y-4">
                {/* Defect Subject */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 block">موضوع خرابی (عیب اصلی) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={defectSubject}
                    onChange={(e) => {
                      setDefectSubject(e.target.value);
                      if (e.target.value.trim()) {
                        setDefectSubjectError(false);
                      }
                    }}
                    placeholder="مثال: دستگاه شارژ نمی‌کند / خاموشی مطلق..."
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold outline-none transition-all border ${
                      defectSubjectError
                        ? 'bg-rose-50/50 border-rose-400 focus:border-rose-600 text-rose-950 placeholder-rose-400/70 ring-1 ring-rose-300/20'
                        : 'bg-slate-50 focus:bg-white border-slate-200 focus:border-blue-600 text-slate-800'
                    }`}
                  />
                  
                  {defectSubjectError && (
                    <p className="text-[9.5px] text-rose-600 font-black flex items-center gap-1.5 mt-1 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>ثبت موضوع خرابی الزامی است. لطفاً کادر بالا را پر کرده یا از کلیدهای کمکی زیر انتخاب کنید.</span>
                    </p>
                  )}
                  
                  {/* Quick Preset Tags for Quick entry */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {defectPresets.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setDefectSubject(tag);
                          setDefectSubjectError(false);
                        }}
                        className={`px-2 py-1 border rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                          defectSubject === tag
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Defect Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 block">شرح کامل خرابی</label>
                  <textarea
                    value={defectDescription}
                    onChange={(e) => setDefectDescription(e.target.value)}
                    placeholder="توضیحات تکمیلی نظیر نحوه بروز عیب، نوسان برق، مدت زمان کارکرد قبل خاموشی..."
                    rows={2.5}
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all resize-none"
                  />
                </div>

                {/* Observed Symptoms */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 block">علائم مشاهده شده در پذیرش</label>
                  <input
                    type="text"
                    value={defectSymptoms}
                    onChange={(e) => setDefectSymptoms(e.target.value)}
                    placeholder="مثال: صدای ویزویز ترانس، بوی سوختگی قطعات، داغ شدن آی‌سی..."
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                  />
                </div>

                {/* Repair Priority Segment selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 block">اولویت تعمیرات کارگاه</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { 
                        id: 'normal', 
                        label: 'عادی', 
                        desc: 'تا ۵ روز کاری',
                        dotClass: 'bg-slate-400',
                        activeClass: 'bg-slate-50 border-slate-300 text-slate-800 ring-1 ring-slate-200/50',
                        inactiveClass: 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      },
                      { 
                        id: 'urgent', 
                        label: 'فوری', 
                        desc: '۲۴ الی ۴۸ ساعت',
                        dotClass: 'bg-orange-500 animate-pulse',
                        activeClass: 'bg-orange-50 border-orange-300 text-orange-800 ring-1 ring-orange-200/50 font-black',
                        inactiveClass: 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      },
                      { 
                        id: 'very_urgent', 
                        label: 'خیلی فوری', 
                        desc: 'خارج از نوبت',
                        dotClass: 'bg-rose-500',
                        activeClass: 'bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-200/50 font-black',
                        inactiveClass: 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }
                    ].map((p) => {
                      const isSel = repairPriority === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setRepairPriority(p.id as any)}
                          className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${
                            isSel ? p.activeClass : p.inactiveClass
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${p.dotClass}`}></span>
                            <span className="text-[11px] font-black">{p.label}</span>
                          </div>
                          <span className="text-[8.5px] text-slate-400 font-bold mt-1">{p.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ACTION COMMANDS */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors cursor-pointer"
                >
                  بازگشت
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!defectSubject.trim()) {
                      setDefectSubjectError(true);
                      showToast('لطفاً موضوع خرابی (عیب اصلی) را برای جلوگیری از ثبت فرم ناقص پر کنید.', 'info');
                      return;
                    }
                    setDefectSubjectError(false);
                    setStep(4);
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>ثبت و ادامه به لوازم همراه</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: PHYSICAL STATE & ACCESSORIES */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <CheckSquare className="text-blue-600 w-4.5 h-4.5" />
                  <span>مرحله چهارم: بررسی وضعیت ظاهری و لوازم همراه</span>
                </h3>
                <p className="text-[11px] text-slate-400">آسیب‌های فیزیکی قطعه و لوازم همراه تحویل‌شده به انبار را علامت بزنید.</p>
              </div>

              {/* PHYSICAL STATE CHECKBOXES */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-500 block">۱. وضعیت ظاهری دستگاه</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'impact', label: 'ضربه‌خوردگی دارد' },
                    { id: 'breakage', label: 'شکستگی بدنه/پورت' },
                    { id: 'water', label: 'آب‌خوردگی/رطوبت' },
                    { id: 'burn', label: 'جای سوختگی/لحیم‌کاری' },
                    { id: 'tampered', label: 'دستکاری شده/تعمیر غیرمجاز' },
                    { id: 'sealBroken', label: 'پلمب باز شده' },
                    { id: 'scratches', label: 'خط و خش شدید' },
                    { id: 'perfect', label: 'بدون ایراد ظاهری (تمیز)' }
                  ].map((item) => {
                    const active = physicalCondition[item.id as keyof typeof physicalCondition];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePhysicalConditionChange(item.id as any)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/50'
                        }`}
                      >
                        <span className="text-[11px] font-black">{item.label}</span>
                        {active ? (
                          <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    value={physicalConditionNotes}
                    onChange={(e) => setPhysicalConditionNotes(e.target.value)}
                    placeholder="توضیحات فیزیکی اختیاری (مثال: گوشه سمت راست پایینی پریده است)..."
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                  />
                </div>
              </div>

              {/* ACCESSORIES CHECKBOXES */}
              <div className="space-y-3.5 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 block">۲. لوازم همراه دستگاه</span>
                  <span className="text-[9px] text-slate-400 font-bold">۶ قلم پیش‌فرض + اقلام سفارشی</span>
                </div>

                {/* Standard items */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {accessoriesList.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleAccessoryChecked(item.id)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        item.checked
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      {item.checked ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                      <span className="text-[10px] font-black">{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* Dynamic 'Other' Accessory input if 'other' is selected */}
                {accessoriesList.find(item => item.id === 'other')?.checked && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60"
                  >
                    <label className="text-[10px] font-black text-amber-800 block">مشخصات قلم همراه (سایر):</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={otherAccessoryInput}
                        onChange={(e) => setOtherAccessoryInput(e.target.value)}
                        placeholder="نام قطعه/لوازم همراه دیگر را بنویسید (مثال: کابل فیبر، آداپتور رکمونت)..."
                        className="flex-1 px-3 py-2 bg-white border border-amber-300 focus:border-amber-500 rounded-xl text-xs font-bold outline-none transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (otherAccessoryInput.trim()) {
                              addCustomAccessory(otherAccessoryInput.trim());
                              setOtherAccessoryInput('');
                              toggleAccessoryChecked('other');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (otherAccessoryInput.trim()) {
                            addCustomAccessory(otherAccessoryInput.trim());
                            setOtherAccessoryInput('');
                            toggleAccessoryChecked('other');
                          }
                        }}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ثبت قلم</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Adding new custom accessory */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 block">افزودن لوازم همراه متفرقه یا مازاد</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customAccessoryInput}
                      onChange={(e) => setCustomAccessoryInput(e.target.value)}
                      placeholder="مثال: ریل ۴۰۵، مبدل برق، رم ریدر..."
                      className="flex-1 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customAccessoryInput.trim()) {
                            addCustomAccessory(customAccessoryInput);
                            setCustomAccessoryInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customAccessoryInput.trim()) {
                          addCustomAccessory(customAccessoryInput);
                          setCustomAccessoryInput('');
                        }
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>

                {/* Custom added accessories list as chips */}
                {accessoriesList.some(item => item.isCustom) && (
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black text-slate-500 block">اقلام متفرقه پذیرش شده:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {accessoriesList.filter(item => item.isCustom).map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all text-xs font-black ${
                            item.checked
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleAccessoryChecked(item.id)}
                            className="flex items-center gap-1.5 cursor-pointer text-right"
                          >
                            {item.checked ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            )}
                            <span className="text-[10px] font-black">{item.label}</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => removeCustomAccessory(item.id)}
                            className="mr-1 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION COMMANDS */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors cursor-pointer"
                >
                  بازگشت
                </button>

                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>ادامه به بارگذاری عکس</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 5: CAMERA CAPTURE & FINAL SUBMIT */}
        {step === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <Camera className="text-blue-600 w-4.5 h-4.5" />
                  <span>مرحله پنجم: مستندسازی تصویر فیزیکی قطعه</span>
                </h3>
                <p className="text-[11px] text-slate-400">عکس فیزیکی از قطعه تحویلی بگیرید تا در آرشیو کارگاه با شناسه فنی ثبت گردد.</p>
              </div>

              {/* MOCK PHOTOS GRID AREA */}
              <div className="space-y-3">
                {photos.length > 0 && (
                  <div className={photos.length > 3 ? "flex gap-2.5 overflow-x-auto pb-2.5 snap-x scrollbar-thin scrollbar-thumb-slate-200" : "grid grid-cols-3 gap-2"}>
                    <AnimatePresence initial={false}>
                      {photos.map((url, idx) => (
                        <motion.div
                          key={url}
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, x: -15 }}
                          transition={{ duration: 0.25 }}
                          className={`relative rounded-xl overflow-hidden border border-slate-200 group h-24 ${photos.length > 3 ? 'w-28 shrink-0 snap-start' : ''}`}
                        >
                          <img src={url} alt={`Hardware attachment ${idx}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1.5 left-1.5 p-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 ease-out cursor-pointer z-10 flex items-center justify-center"
                            title="حذف عکس"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-center py-0.5">
                            <span className="text-[8px] text-white font-mono">پیوست #{idx + 1}</span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* CAPTURING INTERACTIVE WINDOW */}
                {isCapturing ? (
                  <div className="bg-black rounded-2xl overflow-hidden relative h-56 flex flex-col justify-between border-2 border-blue-500">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>ثبت عکس فیزیکی</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50"
                    >
                      <Camera className="w-5 h-5 text-slate-400" />
                      <span className="text-[10px] font-black">دوربین قطعه</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50"
                    >
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-[10px] font-black">انتخاب از گالری</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Sandbox quick generator button */}
                {!isCapturing && (
                  <button
                    type="button"
                    onClick={simulateAddPhoto}
                    className="w-full py-2 bg-amber-50/50 hover:bg-amber-100 border border-amber-200/50 text-amber-800 text-[9px] font-black rounded-xl transition-colors cursor-pointer text-center"
                  >
                    📸 شبیه‌سازی بارگذاری سریع عکس قطعه الکترونیکی کارگاهی
                  </button>
                )}
              </div>

              {/* ACTION COMMANDS */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors cursor-pointer"
                >
                  بازگشت
                </button>

                <button
                  type="button"
                  onClick={handleSubmitReception}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span>ثبت نهایی پذیرش دستگاه و صدور رسید ⚡</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
