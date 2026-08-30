import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Boxes, 
  FileText, 
  Wrench, 
  Plus, 
  Search, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  Eye, 
  Printer, 
  Copy, 
  Power,
  Layers
} from 'lucide-react';
import { Product, BOMFormula, BOMComponent, ProductType, ActiveTab } from '../types';

interface ProductionUnitProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  boms: BOMFormula[];
  setBoms: React.Dispatch<React.SetStateAction<BOMFormula[]>>;
  setActiveTab?: (tab: ActiveTab) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  userRole?: string;
}

export const ProductionUnit: React.FC<ProductionUnitProps> = ({
  products,
  setProducts,
  boms,
  setBoms,
  setActiveTab,
  showToast
}) => {
  // Navigation tabs within Production Unit
  const [activeSubTab, setActiveSubTab] = useState<'manufactured' | 'boms' | 'components'>('manufactured');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [bomFilter, setBomFilter] = useState<'all' | 'has_bom' | 'no_bom'>('all');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BOMFormula | null>(null);

  const [viewingBom, setViewingBom] = useState<BOMFormula | null>(null);

  // Product form state (Strictly for manufactured products in subtab 1)
  const [prodFormName, setProdFormName] = useState('');
  const [prodFormModel, setProdFormModel] = useState('');
  const [prodFormCode, setProdFormCode] = useState('');
  const [prodFormCategory, setProdFormCategory] = useState('محصولات تولیدی');
  const [prodFormUnit, setProdFormUnit] = useState('دستگاه');
  const [prodFormWarranty, setProdFormWarranty] = useState('12');
  const [prodFormSellingPrice, setProdFormSellingPrice] = useState('');
  const [prodFormDescription, setProdFormDescription] = useState('');

  // Component form state (for Subtab 3: raw materials)
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [editingComponentItem, setEditingComponentItem] = useState<Product | null>(null);
  const [compFormName, setCompFormName] = useState('');
  const [compFormCode, setCompFormCode] = useState('');
  const [compFormType, setCompFormType] = useState<ProductType>('raw_material');
  const [compFormUnit, setCompFormUnit] = useState('عدد');
  const [compFormCost, setCompFormCost] = useState('');
  const [compFormDescription, setCompFormDescription] = useState('');

  // BOM Form state
  const [bomFormTitle, setBomFormTitle] = useState('');
  const [bomFormTargetProdId, setBomFormTargetProdId] = useState('');
  const [bomFormVersion, setBomFormVersion] = useState('1.0');
  const [bomFormOutputQty, setBomFormOutputQty] = useState(1);
  const [bomFormOutputUnit, setBomFormOutputUnit] = useState('دستگاه');
  const [bomFormLaborCost, setBomFormLaborCost] = useState('');
  const [bomFormOverheadCost, setBomFormOverheadCost] = useState('');
  const [bomFormDescription, setBomFormDescription] = useState('');
  const [bomFormIsActive, setBomFormIsActive] = useState(true);
  const [bomFormComponents, setBomFormComponents] = useState<BOMComponent[]>([]);
  const [bomFormError, setBomFormError] = useState('');

  // Helper: format numbers in Persian
  const formatNum = (val: number | string | undefined): string => {
    if (val === undefined || val === null || val === '') return '۰';
    const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : val;
    if (isNaN(num)) return '۰';
    return num.toLocaleString('fa-IR');
  };

  const parseNumberInput = (str: string): number => {
    if (!str) return 0;
    const enStr = str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/,/g, '');
    const val = parseFloat(enStr);
    return isNaN(val) ? 0 : val;
  };

  // Helper: Format ISO date string into Persian readable date
  const formatPersianDate = (isoStr?: string): string => {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    } catch {
      return isoStr;
    }
  };

  // Helper: map product type to Persian label
  const getProductTypeLabel = (type?: ProductType): { label: string; bg: string; text: string; border: string } => {
    switch (type) {
      case 'manufactured':
        return { label: 'محصول تولیدی', bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-300' };
      case 'raw_material':
        return { label: 'قطعه / ماده اولیه', bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-300' };
      case 'purchased':
        return { label: 'کالای خریداری‌شده', bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-300' };
      case 'consumable':
        return { label: 'کالای مصرفی', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' };
      case 'service':
        return { label: 'خدمت / اجرت', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' };
      default:
        return { label: 'نامشخص', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' };
    }
  };

  // 1. Manufactured products strictly where productType === 'manufactured'
  const manufacturedProducts = useMemo(() => {
    return products.filter(p => p.productType === 'manufactured');
  }, [products]);

  // Active manufactured products (available for new BOM assignment)
  const activeManufacturedProducts = useMemo(() => {
    return manufacturedProducts.filter(p => p.isActive !== false);
  }, [manufacturedProducts]);

  // 2. Allowed components for BOM strictly: raw_material, purchased, consumable
  const rawMaterialProducts = useMemo(() => {
    return products.filter(p => 
      p.productType === 'raw_material' || 
      p.productType === 'purchased' || 
      p.productType === 'consumable'
    );
  }, [products]);

  // Map product to active BOM (by finishedProductId or productCode)
  const bomsByProduct = useMemo(() => {
    const map = new Map<string, BOMFormula>();
    boms.forEach(b => {
      if (b.isActive) {
        if (b.finishedProductId) {
          map.set(b.finishedProductId, b);
        }
        if (b.productCode) {
          map.set(b.productCode.trim().toLowerCase(), b);
        }
      }
    });
    return map;
  }, [boms]);

  // Filtered manufactured products based on search & BOM status
  const filteredProducts = useMemo(() => {
    return manufacturedProducts.filter(p => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = 
        (p.name || '').toLowerCase().includes(q) ||
        (p.model || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q);

      const hasBom = bomsByProduct.has(p.id) || (p.code ? bomsByProduct.has(p.code.trim().toLowerCase()) : false);
      if (bomFilter === 'has_bom' && !hasBom) return false;
      if (bomFilter === 'no_bom' && hasBom) return false;

      return matchesSearch;
    });
  }, [manufacturedProducts, searchQuery, bomFilter, bomsByProduct]);

  // Filtered BOMs
  const filteredBoms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return boms.filter(b => {
      return (
        (b.title || '').toLowerCase().includes(q) ||
        (b.productName || '').toLowerCase().includes(q) ||
        (b.productCode || '').toLowerCase().includes(q) ||
        (b.version || '').toLowerCase().includes(q)
      );
    });
  }, [boms, searchQuery]);

  // ----------------------------------------------------
  // MANUFACTURED PRODUCT ACTIONS (NO PHYSICAL DELETE)
  // ----------------------------------------------------

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdFormName('');
    setProdFormModel('');
    setProdFormCode('');
    setProdFormCategory('محصولات تولیدی');
    setProdFormUnit('دستگاه');
    setProdFormWarranty('12');
    setProdFormSellingPrice('');
    setProdFormDescription('');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdFormName(prod.name || '');
    setProdFormModel(prod.model || '');
    setProdFormCode(prod.code || '');
    setProdFormCategory(prod.category || 'محصولات تولیدی');
    setProdFormUnit(prod.unit || 'دستگاه');
    setProdFormWarranty(prod.warrantyDuration || '12');
    setProdFormSellingPrice(prod.sellingPrice || prod.suggestedPrice || '');
    setProdFormDescription(prod.description || '');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = prodFormName.trim();
    const trimmedCode = prodFormCode.trim();

    if (!trimmedName) {
      showToast('نام محصول تولیدی الزامی است.', 'error');
      return;
    }
    if (!trimmedCode) {
      showToast('کد محصول الزامی است.', 'error');
      return;
    }

    // Uniqueness validation across all products (trimmed, case-insensitive)
    const duplicateCode = products.some(p => 
      p.code?.trim().toLowerCase() === trimmedCode.toLowerCase() &&
      (!editingProduct || p.id !== editingProduct.id)
    );

    if (duplicateCode) {
      showToast('کد محصول واردشده قبلاً برای کالای دیگری ثبت شده است.', 'error');
      return;
    }

    if (editingProduct) {
      setProducts(prev => prev.map(p => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            name: trimmedName,
            model: prodFormModel.trim(),
            code: trimmedCode,
            category: prodFormCategory,
            productType: 'manufactured',
            unit: prodFormUnit,
            warrantyDuration: prodFormWarranty,
            suggestedPrice: prodFormSellingPrice,
            sellingPrice: prodFormSellingPrice,
            description: prodFormDescription.trim()
          };
        }
        return p;
      }));
      showToast(`محصول تولیدی «${trimmedName}» با موفقیت ویرایش شد.`, 'success');
    } else {
      const newProd: Product = {
        id: `PROD-${Date.now()}`,
        name: trimmedName,
        model: prodFormModel.trim(),
        code: trimmedCode,
        category: prodFormCategory,
        productType: 'manufactured',
        unit: prodFormUnit,
        warrantyDuration: prodFormWarranty,
        suggestedPrice: prodFormSellingPrice,
        sellingPrice: prodFormSellingPrice,
        description: prodFormDescription.trim(),
        isActive: true
      };
      setProducts(prev => [newProd, ...prev]);
      showToast(`محصول تولیدی «${trimmedName}» با موفقیت ثبت گردید.`, 'success');
    }

    setIsProductModalOpen(false);
  };

  // Toggle active/inactive for manufactured product (Soft state instead of physical deletion)
  const handleToggleProductActive = (product: Product) => {
    const isCurrentlyActive = product.isActive !== false;
    const confirmMessage = isCurrentlyActive
      ? `آیا از غیرفعال‌سازی محصول تولیدی «${product.name}» اطمینان دارید؟ (سوابق و فرمول‌های ساخت آن حفظ می‌شوند)`
      : `آیا از فعال‌سازی مجدد محصول تولیدی «${product.name}» اطمینان دارید؟`;

    if (!window.confirm(confirmMessage)) return;

    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !isCurrentlyActive } : p));
    showToast(
      isCurrentlyActive ? `محصول «${product.name}» غیرفعال شد.` : `محصول «${product.name}» مجدداً فعال گردید.`,
      isCurrentlyActive ? 'info' : 'success'
    );
  };

  // ----------------------------------------------------
  // RAW MATERIAL / COMPONENT MODAL (SUBTAB 3)
  // ----------------------------------------------------
  const handleOpenAddComponent = () => {
    setEditingComponentItem(null);
    setCompFormName('');
    setCompFormCode('');
    setCompFormType('raw_material');
    setCompFormUnit('عدد');
    setCompFormCost('');
    setCompFormDescription('');
    setIsComponentModalOpen(true);
  };

  const handleOpenEditComponent = (item: Product) => {
    setEditingComponentItem(item);
    setCompFormName(item.name || '');
    setCompFormCode(item.code || '');
    setCompFormType(item.productType || 'raw_material');
    setCompFormUnit(item.unit || 'عدد');
    setCompFormCost(item.productionPrice || item.suggestedPrice || (item.price ? item.price.toString() : ''));
    setCompFormDescription(item.description || '');
    setIsComponentModalOpen(true);
  };

  const handleSaveComponent = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = compFormName.trim();
    const trimmedCode = compFormCode.trim();

    if (!trimmedName) {
      showToast('نام قطعه / ماده اولیه الزامی است.', 'error');
      return;
    }
    if (!trimmedCode) {
      showToast('کد قطعه الزامی است.', 'error');
      return;
    }

    const duplicateCode = products.some(p => 
      p.code?.trim().toLowerCase() === trimmedCode.toLowerCase() &&
      (!editingComponentItem || p.id !== editingComponentItem.id)
    );

    if (duplicateCode) {
      showToast('کد کالا واردشده قبلاً ثبت شده است.', 'error');
      return;
    }

    const costNum = parseNumberInput(compFormCost);

    if (editingComponentItem) {
      setProducts(prev => prev.map(p => {
        if (p.id === editingComponentItem.id) {
          return {
            ...p,
            name: trimmedName,
            code: trimmedCode,
            productType: compFormType,
            unit: compFormUnit,
            productionPrice: costNum > 0 ? `${costNum.toLocaleString('fa-IR')} تومان` : '',
            price: costNum,
            description: compFormDescription.trim()
          };
        }
        return p;
      }));
      showToast(`قطعه «${trimmedName}» با موفقیت ویرایش شد.`, 'success');
    } else {
      const newComp: Product = {
        id: `RAW-${Date.now()}`,
        name: trimmedName,
        code: trimmedCode,
        category: 'قطعات و مواد اولیه',
        productType: compFormType,
        unit: compFormUnit,
        productionPrice: costNum > 0 ? `${costNum.toLocaleString('fa-IR')} تومان` : '',
        price: costNum,
        description: compFormDescription.trim(),
        isActive: true
      };
      setProducts(prev => [newComp, ...prev]);
      showToast(`قطعه «${trimmedName}» با موفقیت به بانک اقلام افزوده شد.`, 'success');
    }
    setIsComponentModalOpen(false);
  };

  // Toggle active/inactive for raw material
  const handleToggleComponentActive = (item: Product) => {
    const isCurrentlyActive = item.isActive !== false;
    const confirmMessage = isCurrentlyActive
      ? `آیا از غیرفعال‌سازی قطعه «${item.name}» اطمینان دارید؟`
      : `آیا از فعال‌سازی مجدد قطعه «${item.name}» اطمینان دارید؟`;

    if (!window.confirm(confirmMessage)) return;

    setProducts(prev => prev.map(p => p.id === item.id ? { ...p, isActive: !isCurrentlyActive } : p));
    showToast(isCurrentlyActive ? 'قطعه غیرفعال شد.' : 'قطعه مجدداً فعال گردید.', isCurrentlyActive ? 'info' : 'success');
  };

  // ----------------------------------------------------
  // BOM ACTIONS (NO PHYSICAL DELETE, SINGLE ACTIVE RULE)
  // ----------------------------------------------------

  const handleOpenAddBom = (targetProduct?: Product) => {
    setEditingBom(null);
    const chosenProduct = targetProduct || activeManufacturedProducts[0] || manufacturedProducts[0];
    
    if (!chosenProduct) {
      showToast('ابتدا باید حداقل یک محصول تولیدی تعریف نمایید.', 'error');
      return;
    }

    setBomFormTargetProdId(chosenProduct.id);
    setBomFormTitle(`فرمول ساخت استاندارد ${chosenProduct.name}`);
    setBomFormVersion('1.0');
    setBomFormOutputQty(1);
    setBomFormOutputUnit(chosenProduct.unit || 'دستگاه');
    setBomFormLaborCost('0');
    setBomFormOverheadCost('0');
    setBomFormDescription('');
    setBomFormIsActive(true);
    setBomFormError('');

    // Start with 1 empty component row
    setBomFormComponents([
      {
        id: `CMP-${Date.now()}-1`,
        name: '',
        code: '',
        unit: 'عدد',
        quantity: 1,
        unitCost: 0,
        wastePercentage: 0,
        notes: ''
      }
    ]);

    setIsBomModalOpen(true);
  };

  const handleOpenEditBom = (bom: BOMFormula) => {
    setEditingBom(bom);
    
    // Resolve matching product ID
    const targetProd = products.find(p => p.id === bom.finishedProductId || p.code === bom.productCode);
    setBomFormTargetProdId(targetProd?.id || bom.finishedProductId || '');
    setBomFormTitle(bom.title);
    setBomFormVersion(bom.version || '1.0');
    setBomFormOutputQty(bom.outputQuantity || 1);
    setBomFormOutputUnit(bom.outputUnit || 'دستگاه');
    setBomFormLaborCost(bom.laborCost ? bom.laborCost.toLocaleString('fa-IR') : '0');
    setBomFormOverheadCost(bom.overheadCost ? bom.overheadCost.toLocaleString('fa-IR') : '0');
    setBomFormDescription(bom.description || '');
    setBomFormIsActive(bom.isActive);
    setBomFormComponents(bom.components ? bom.components.map(c => ({ ...c })) : []);
    setBomFormError('');
    setIsBomModalOpen(true);
  };

  // Duplicate BOM: Always creates as inactive copy to avoid conflicting active BOMs
  const handleDuplicateBom = (bom: BOMFormula) => {
    const existingVersions = boms
      .filter(b => (b.finishedProductId && b.finishedProductId === bom.finishedProductId) || b.productCode === bom.productCode)
      .map(b => (b.version || '1.0').trim().toLowerCase());

    let nextVer = `${bom.version || '1.0'}-copy`;
    let counter = 1;
    while (existingVersions.includes(nextVer.toLowerCase())) {
      counter++;
      nextVer = `${bom.version || '1.0'}-v${counter}`;
    }

    const newBom: BOMFormula = {
      ...bom,
      id: `BOM-${Date.now()}`,
      title: `${bom.title} (رونوشت)`,
      version: nextVer,
      isActive: false, // Must be inactive so duplicate doesn't violate single active BOM rule
      createdAt: new Date().toISOString(),
      updatedAt: undefined,
      components: bom.components.map(c => ({
        ...c,
        id: `CMP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      }))
    };

    setBoms(prev => [newBom, ...prev]);
    showToast(`رونوشت فرمول ساخت ایجاد شد (نسخه ${nextVer} در وضعیت غیرفعال).`, 'success');
  };

  // Toggle active status of a BOM (Enforces ONE ACTIVE BOM PER PRODUCT)
  const handleToggleBomActive = (bom: BOMFormula) => {
    if (bom.isActive) {
      if (!window.confirm(`آیا از غیرفعال‌سازی فرمول ساخت «${bom.title}» اطمینان دارید؟`)) return;
      setBoms(prev => prev.map(b => b.id === bom.id ? { ...b, isActive: false, updatedAt: new Date().toISOString() } : b));
      showToast(`فرمول ساخت «${bom.title}» غیرفعال شد.`, 'info');
    } else {
      if (!window.confirm(`با فعال‌سازی فرمول «${bom.title}»، سایر فرمول‌های این محصول غیرفعال می‌شوند. آیا ادامه می‌دهید؟`)) return;
      
      const targetId = bom.finishedProductId;
      const targetCode = bom.productCode;

      setBoms(prev => prev.map(b => {
        const belongsToSameProduct = 
          (targetId && b.finishedProductId === targetId) ||
          (targetCode && b.productCode?.trim().toLowerCase() === targetCode.trim().toLowerCase());

        if (b.id === bom.id) {
          return { ...b, isActive: true, updatedAt: new Date().toISOString() };
        } else if (belongsToSameProduct) {
          return { ...b, isActive: false };
        }
        return b;
      }));
      showToast(`فرمول ساخت «${bom.title}» به عنوان فرمول فعال محصول تعیین گردید.`, 'success');
    }
  };

  // Add component row in BOM form
  const handleAddComponentRow = () => {
    setBomFormComponents(prev => [
      ...prev,
      {
        id: `CMP-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: '',
        code: '',
        unit: 'عدد',
        quantity: 1,
        unitCost: 0,
        wastePercentage: 0,
        notes: ''
      }
    ]);
  };

  // Remove component row in BOM form
  const handleRemoveComponentRow = (id: string) => {
    if (bomFormComponents.length <= 1) {
      showToast('فرمول ساخت باید حداقل شامل یک قطعه یا ماده اولیه باشد.', 'error');
      return;
    }
    setBomFormComponents(prev => prev.filter(c => c.id !== id));
  };

  // Type-safe update of component text fields
  const handleUpdateComponentText = (id: string, field: 'name' | 'code' | 'unit' | 'notes', value: string) => {
    setBomFormComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Type-safe update of component numeric fields
  const handleUpdateComponentNumber = (id: string, field: 'quantity' | 'unitCost' | 'wastePercentage', value: number) => {
    const cleanVal = isNaN(value) ? 0 : Math.max(0, value);
    setBomFormComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: cleanVal } : c));
  };

  // Auto-fill component from existing raw materials (Rule 9 & 10: Strict component types & uniqueness)
  const handleSelectRawMaterial = (componentId: string, selectedProductId: string) => {
    const found = products.find(p => p.id === selectedProductId || p.code === selectedProductId);
    if (!found) return;

    const targetProduct = products.find(p => p.id === bomFormTargetProdId);

    // Guard: Circular dependency (Cannot add target product itself as a component)
    if (targetProduct && (found.id === targetProduct.id || (found.code && found.code === targetProduct.code))) {
      showToast('امکان انتخاب خود محصول نهایی به عنوان قطعه تشکیل‌دهنده وجود ندارد.', 'error');
      return;
    }

    // Guard: Only raw_material, purchased, or consumable allowed
    if (found.productType !== 'raw_material' && found.productType !== 'purchased' && found.productType !== 'consumable') {
      showToast('تنها قطعات، مواد اولیه و کالاهای مصرفی قابل افزودن به فرمول هستند.', 'error');
      return;
    }

    // Guard: Unique components in BOM
    const alreadyExists = bomFormComponents.some(c => 
      c.id !== componentId && 
      ((c.productId && c.productId === found.id) || (c.code && found.code && c.code.trim().toLowerCase() === found.code.trim().toLowerCase()))
    );

    if (alreadyExists) {
      showToast('این قطعه قبلاً به فرمول ساخت اضافه شده است. لطفاً تعداد آن را در ردیف قبلی افزایش دهید.', 'error');
      return;
    }

    const cost = found.price || parseNumberInput(found.productionPrice || found.suggestedPrice || '0');

    setBomFormComponents(prev => prev.map(c => {
      if (c.id === componentId) {
        return {
          ...c,
          productId: found.id,
          name: found.name,
          code: found.code || '',
          unit: found.unit || 'عدد',
          unitCost: cost || c.unitCost
        };
      }
      return c;
    }));
  };

  // Calculations for BOM direct and total costs
  const calculatedDirectCost = useMemo(() => {
    return bomFormComponents.reduce((sum, item) => {
      const qty = item.quantity || 0;
      const cost = item.unitCost || 0;
      const waste = item.wastePercentage || 0;
      const lineCost = qty * cost * (1 + waste / 100);
      return sum + lineCost;
    }, 0);
  }, [bomFormComponents]);

  const calculatedTotalCost = useMemo(() => {
    const labor = parseNumberInput(bomFormLaborCost);
    const overhead = parseNumberInput(bomFormOverheadCost);
    return calculatedDirectCost + labor + overhead;
  }, [calculatedDirectCost, bomFormLaborCost, bomFormOverheadCost]);

  // Save BOM Form
  const handleSaveBom = (e: React.FormEvent) => {
    e.preventDefault();
    setBomFormError('');

    const trimmedTitle = bomFormTitle.trim();
    if (!trimmedTitle) {
      setBomFormError('لطفاً عنوان فرمول ساخت را وارد نمایید.');
      return;
    }

    if (!bomFormTargetProdId) {
      setBomFormError('لطفاً محصول نهایی مقصد را انتخاب کنید.');
      return;
    }

    const targetProduct = products.find(p => p.id === bomFormTargetProdId);
    if (!targetProduct) {
      setBomFormError('محصول نهایی انتخاب‌شده نامعتبر است.');
      return;
    }

    // Version uniqueness check for this product
    const trimmedVersion = (bomFormVersion || '1.0').trim().toLowerCase();
    const isDuplicateVersion = boms.some(b => 
      ((b.finishedProductId && b.finishedProductId === targetProduct.id) || b.productCode === targetProduct.code) &&
      (b.version || '1.0').trim().toLowerCase() === trimmedVersion &&
      (!editingBom || b.id !== editingBom.id)
    );

    if (isDuplicateVersion) {
      setBomFormError('این نسخه از فرمول ساخت قبلاً برای محصول انتخاب‌شده ثبت شده است.');
      return;
    }

    // Output validations
    if (bomFormOutputQty <= 0 || isNaN(bomFormOutputQty)) {
      setBomFormError('تعداد خروجی فرمول باید بزرگتر از صفر باشد.');
      return;
    }
    if (!bomFormOutputUnit.trim()) {
      setBomFormError('واحد خروجی فرمول الزامی است.');
      return;
    }

    // Component validations
    if (bomFormComponents.length === 0) {
      setBomFormError('حداقل یک قطعه یا ماده اولیه برای فرمول الزامی است.');
      return;
    }

    const seenIds = new Set<string>();
    const seenCodes = new Set<string>();

    for (let i = 0; i < bomFormComponents.length; i++) {
      const cmp = bomFormComponents[i];
      if (!cmp.name.trim()) {
        setBomFormError(`نام قطعه در ردیف ${i + 1} الزامی است.`);
        return;
      }
      if (cmp.quantity <= 0 || isNaN(cmp.quantity)) {
        setBomFormError(`تعداد قطعه «${cmp.name}» باید یک عدد مثبت بزرگتر از صفر باشد.`);
        return;
      }
      if (cmp.wastePercentage === undefined || cmp.wastePercentage < 0 || isNaN(cmp.wastePercentage)) {
        setBomFormError(`درصد افت و پرتی قطعه «${cmp.name}» باید صفر یا بزرگتر باشد.`);
        return;
      }
      if (!cmp.unit.trim()) {
        setBomFormError(`واحد سنجش قطعه «${cmp.name}» الزامی است.`);
        return;
      }

      // Check duplicate components within the formula
      const compKey = cmp.productId || cmp.code?.trim().toLowerCase() || cmp.name.trim().toLowerCase();
      if (cmp.productId && seenIds.has(cmp.productId)) {
        setBomFormError(`قطعه «${cmp.name}» بیش از یک‌بار در فرمول تکرار شده است. لطفاً تعداد آن را تجمیع نمایید.`);
        return;
      }
      if (compKey && seenCodes.has(compKey)) {
        setBomFormError(`قطعه «${cmp.name}» بیش از یک‌بار در فرمول تکرار شده است. لطفاً تعداد آن را تجمیع نمایید.`);
        return;
      }
      if (cmp.productId) seenIds.add(cmp.productId);
      if (compKey) seenCodes.add(compKey);
    }

    const labor = parseNumberInput(bomFormLaborCost);
    const overhead = parseNumberInput(bomFormOverheadCost);
    const nowIso = new Date().toISOString();

    if (editingBom) {
      const updatedBom: BOMFormula = {
        ...editingBom,
        finishedProductId: targetProduct.id,
        title: trimmedTitle,
        productCode: targetProduct.code || targetProduct.model || '',
        productName: targetProduct.name,
        productModel: targetProduct.model,
        version: bomFormVersion.trim() || '1.0',
        outputQuantity: bomFormOutputQty,
        outputUnit: bomFormOutputUnit.trim(),
        components: bomFormComponents,
        laborCost: labor,
        overheadCost: overhead,
        totalDirectCost: calculatedDirectCost,
        totalEstimatedCost: calculatedTotalCost,
        description: bomFormDescription.trim(),
        isActive: bomFormIsActive,
        updatedAt: nowIso
      };

      setBoms(prev => prev.map(b => {
        // Enforce ONE ACTIVE BOM rule for this product
        if (bomFormIsActive) {
          const isSameProduct = (b.finishedProductId && b.finishedProductId === targetProduct.id) || b.productCode === targetProduct.code;
          if (isSameProduct && b.id !== editingBom.id) {
            return { ...b, isActive: false };
          }
        }
        return b.id === editingBom.id ? updatedBom : b;
      }));

      showToast(`فرمول ساخت «${trimmedTitle}» با موفقیت به‌روزرسانی شد.`, 'success');
    } else {
      const newBom: BOMFormula = {
        id: `BOM-${Date.now()}`,
        finishedProductId: targetProduct.id,
        title: trimmedTitle,
        productCode: targetProduct.code || targetProduct.model || '',
        productName: targetProduct.name,
        productModel: targetProduct.model,
        version: bomFormVersion.trim() || '1.0',
        outputQuantity: bomFormOutputQty,
        outputUnit: bomFormOutputUnit.trim(),
        components: bomFormComponents,
        laborCost: labor,
        overheadCost: overhead,
        totalDirectCost: calculatedDirectCost,
        totalEstimatedCost: calculatedTotalCost,
        description: bomFormDescription.trim(),
        isActive: bomFormIsActive,
        createdAt: nowIso
      };

      setBoms(prev => {
        // If new BOM is active, deactivate other BOMs for that product
        const nextList = bomFormIsActive
          ? prev.map(b => {
              const isSameProduct = (b.finishedProductId && b.finishedProductId === targetProduct.id) || b.productCode === targetProduct.code;
              return isSameProduct ? { ...b, isActive: false } : b;
            })
          : [...prev];

        return [newBom, ...nextList];
      });

      showToast(`فرمول ساخت «${trimmedTitle}» برای محصول «${targetProduct.name}» ثبت شد.`, 'success');
    }

    setIsBomModalOpen(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-6xl mx-auto space-y-5 p-3 sm:p-5 rounded-3xl bg-[#E9EDF3] border border-slate-300 shadow-xs font-sans text-right select-none"
      dir="rtl"
    >
      {/* 1. Header with Breadcrumb & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#DCE6F2] p-4 sm:p-5 rounded-2xl border border-blue-300">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Boxes className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              واحد تولید و فرمول‌های ساخت (BOM)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 font-medium">
            تعریف محصولات تولیدی، فرمول ساخت استاندارد (BOM)، تعیین اقلام مصرفی و برآورد بهای تمام‌شده
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('accounting_dashboard')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به میز کار</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sub-Tabs Switcher */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-300 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('manufactured')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
              activeSubTab === 'manufactured'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>محصولات تولیدی</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
              activeSubTab === 'manufactured' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {manufacturedProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('boms')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
              activeSubTab === 'boms'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>فرمول‌های ساخت (BOM)</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
              activeSubTab === 'boms' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {boms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('components')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
              activeSubTab === 'components'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>بانک قطعات و مواد اولیه</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
              activeSubTab === 'components' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {rawMaterialProducts.length}
            </span>
          </button>
        </div>

        {/* Action Button depending on subtab */}
        <div className="shrink-0">
          {activeSubTab === 'manufactured' && (
            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف محصول تولیدی جدید</span>
            </button>
          )}

          {activeSubTab === 'boms' && (
            <button
              type="button"
              onClick={() => handleOpenAddBom()}
              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد فرمول ساخت جدید (BOM)</span>
            </button>
          )}

          {activeSubTab === 'components' && (
            <button
              type="button"
              onClick={handleOpenAddComponent}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف قطعه یا ماده اولیه</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. SUBTAB 1: MANUFACTURED PRODUCTS */}
      {activeSubTab === 'manufactured' && (
        <div className="space-y-4">
          
          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-100 border border-blue-300 rounded-2xl p-3.5 text-center space-y-1 relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-700">کل محصولات تولیدی</div>
              <div className="text-lg font-black text-slate-900 font-mono">{manufacturedProducts.length}</div>
            </div>

            <div className="bg-emerald-100 border border-emerald-300 rounded-2xl p-3.5 text-center space-y-1 relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-700">دارای فرمول ساخت فعال</div>
              <div className="text-lg font-black text-slate-900 font-mono">
                {manufacturedProducts.filter(p => bomsByProduct.has(p.id) || (p.code ? bomsByProduct.has(p.code.trim().toLowerCase()) : false)).length}
              </div>
            </div>

            <div className="bg-amber-100 border border-amber-300 rounded-2xl p-3.5 text-center space-y-1 relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-700">فاقد فرمول ساخت فعال</div>
              <div className="text-lg font-black text-slate-900 font-mono">
                {manufacturedProducts.filter(p => !bomsByProduct.has(p.id) && (!p.code || !bomsByProduct.has(p.code.trim().toLowerCase()))).length}
              </div>
            </div>

            <div className="bg-purple-100 border border-purple-300 rounded-2xl p-3.5 text-center space-y-1 relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-700">تعداد فرمول‌های BOM</div>
              <div className="text-lg font-black text-slate-900 font-mono">{boms.length}</div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-[#DDE2E9] p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="جستجو در نام محصول، مدل یا کد کالا..."
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 text-xs font-black">
                <button
                  type="button"
                  onClick={() => setBomFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    bomFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  همه ({manufacturedProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBomFilter('has_bom')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    bomFilter === 'has_bom' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  دارای BOM فعال
                </button>
                <button
                  type="button"
                  onClick={() => setBomFilter('no_bom')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    bomFilter === 'no_bom' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  بدون BOM
                </button>
              </div>
            </div>
          </div>

          {/* Products List / Cards */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-300 p-10 text-center space-y-3">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-black text-slate-700">هیچ محصولی با این مشخصات یافت نشد.</p>
              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 hover:bg-blue-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف محصول تولیدی جدید</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredProducts.map(product => {
                const activeBom = bomsByProduct.get(product.id) || (product.code ? bomsByProduct.get(product.code.trim().toLowerCase()) : undefined);
                const costPrice = activeBom ? activeBom.totalEstimatedCost : parseNumberInput(product.productionPrice || '0');
                const sellPrice = parseNumberInput(product.sellingPrice || product.suggestedPrice || '0');
                const profit = sellPrice > 0 && costPrice > 0 ? sellPrice - costPrice : 0;
                const profitMargin = sellPrice > 0 && profit > 0 ? ((profit / sellPrice) * 100).toFixed(1) : '۰';
                const isProductActive = product.isActive !== false;

                return (
                  <div 
                    key={product.id}
                    className={`bg-white border ${isProductActive ? 'border-slate-300 hover:border-slate-400' : 'border-slate-300 bg-slate-50/60 opacity-80'} rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3.5 text-right relative overflow-hidden group`}
                  >
                    {/* Top status line */}
                    <div className={`absolute top-0 right-0 left-0 h-1 ${
                      !isProductActive ? 'bg-slate-400' : activeBom ? 'bg-emerald-600' : 'bg-amber-500'
                    }`} />

                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-black text-slate-900">
                              {product.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {product.code || product.model}
                            </span>
                            {!isProductActive && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700 border border-slate-300">
                                غیرفعال
                              </span>
                            )}
                          </div>
                          {product.model && (
                            <p className="text-xs text-slate-600 font-medium">
                              مدل: <span className="font-mono">{product.model}</span>
                            </p>
                          )}
                        </div>

                        {/* BOM Status Badge */}
                        {activeBom ? (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>دارای BOM فعال</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>فاقد فرمول ساخت</span>
                          </span>
                        )}
                      </div>

                      {product.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* BOM & Financial Metrics */}
                    <div className="bg-[#E9EDF3] p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                      {activeBom ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="font-bold flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-blue-600" />
                              <span>فرمول فعال:</span>
                            </span>
                            <span className="font-black text-slate-900 truncate max-w-[200px]">{activeBom.title}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 text-[11px]">
                            <span>تعداد اقلام قطعات:</span>
                            <span className="font-bold font-mono text-slate-800">{activeBom.components.length} ردیف</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-300 text-slate-800">
                            <span className="font-bold">بهای تمام‌شده برآوردی:</span>
                            <span className="font-black font-mono text-blue-800">{formatNum(activeBom.totalEstimatedCost)} تومان</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-slate-600 py-1">
                          <span className="font-medium text-[11px]">هنوز فرمول ساخت (BOM) برای این کالا تعریف نشده است.</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-300 text-slate-800 font-bold text-[11px]">
                        <span>قیمت فروش مصوب:</span>
                        <span className="font-black font-mono text-emerald-800">
                          {sellPrice > 0 ? `${formatNum(sellPrice)} تومان` : 'تعیین‌نشده'}
                        </span>
                      </div>

                      {sellPrice > 0 && costPrice > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-slate-700">
                          <span>حاشیه سود برآوردی:</span>
                          <span className="font-black font-mono text-indigo-700" dir="ltr">
                            %{profitMargin} (+{formatNum(profit)} تومان)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions (Soft toggle active / View / Edit) */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {activeBom ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setViewingBom(activeBom)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده درخت قطعات</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditBom(activeBom)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>ویرایش فرمول</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAddBom(product)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>ایجاد فرمول ساخت (BOM)</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditProduct(product)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="ویرایش مشخصات کالا"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        
                        {/* Toggle active / inactive instead of physical delete */}
                        <button
                          type="button"
                          onClick={() => handleToggleProductActive(product)}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isProductActive
                              ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                          title={isProductActive ? 'غیرفعال‌سازی محصول' : 'فعال‌سازی مجدد محصول'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* 4. SUBTAB 2: BOM FORMULAS LIST */}
      {activeSubTab === 'boms' && (
        <div className="space-y-4">
          
          {/* Top Search & Create */}
          <div className="bg-[#DDE2E9] p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="جستجو در عنوان فرمول، محصول یا کد..."
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            <div className="text-xs font-bold text-slate-700">
              تعداد فرمول‌های ثبت‌شده: <span className="font-black text-slate-900 font-mono">{filteredBoms.length}</span> فرمول
            </div>
          </div>

          {filteredBoms.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-300 p-10 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-black text-slate-700">فرمول ساختی یافت نشد.</p>
              <button
                type="button"
                onClick={() => handleOpenAddBom()}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 hover:bg-blue-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ایجاد اولین فرمول ساخت (BOM)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBoms.map(bom => (
                <div
                  key={bom.id}
                  className={`bg-white border ${bom.isActive ? 'border-slate-300 hover:border-slate-400' : 'border-slate-300 bg-slate-50/70'} rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold">
                          <FileText className="w-4 h-4" />
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-slate-900">
                          {bom.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          نسخه {bom.version || '1.0'}
                        </span>
                        {bom.isActive ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                            فرمول اصلی فعال
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700 border border-slate-300">
                            غیرفعال / آرشیو
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-normal mr-2">
                          ثبت: {formatPersianDate(bom.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        محصول مقصد: <span className="font-black text-slate-900">{bom.productName}</span> 
                        {bom.productCode && <span className="font-mono text-slate-500 mr-2">({bom.productCode})</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-center flex-wrap">
                      <button
                        type="button"
                        onClick={() => setViewingBom(bom)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>مشاهده درخت قطعات</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateBom(bom)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all"
                        title="ایجاد رونوشت / نسخه جدید"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی نسخه</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditBom(bom)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                        title="ویرایش فرمول"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Toggle active status of BOM */}
                      <button
                        type="button"
                        onClick={() => handleToggleBomActive(bom)}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                          bom.isActive 
                            ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50' 
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title={bom.isActive ? 'غیرفعال‌سازی فرمول' : 'فعال‌سازی به عنوان فرمول اصلی'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Components summary table preview */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-center w-12">#</th>
                          <th className="py-2 px-3">نام قطعه / ماده اولیه</th>
                          <th className="py-2 px-3 text-center">کد قطعه</th>
                          <th className="py-2 px-3 text-center">مقدار مصرف</th>
                          <th className="py-2 px-3 text-center">هزینه واحد</th>
                          <th className="py-2 px-3 text-center">ضریب پرتی</th>
                          <th className="py-2 px-3 text-left">هزینه کل ردیف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {bom.components.map((cmp, idx) => {
                          const lineCost = (cmp.quantity || 0) * (cmp.unitCost || 0) * (1 + (cmp.wastePercentage || 0) / 100);
                          return (
                            <tr key={cmp.id || idx} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {cmp.name}
                                {cmp.notes && <span className="text-[10px] text-slate-400 block font-normal">{cmp.notes}</span>}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-500">{cmp.code || '—'}</td>
                              <td className="py-2 px-3 text-center font-mono font-bold">
                                {cmp.quantity} {cmp.unit}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-600">
                                {formatNum(cmp.unitCost)} ت
                              </td>
                              <td className="py-2 px-3 text-center font-mono">
                                {cmp.wastePercentage ? `%${cmp.wastePercentage}` : '۰٪'}
                              </td>
                              <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                                {formatNum(lineCost)} ت
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* BOM Financial Bar */}
                  <div className="bg-[#E9EDF3] p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[11px]">جمع هزینه مستقیم قطعات:</span>
                      <span className="font-black font-mono text-slate-900">{formatNum(bom.totalDirectCost)} تومان</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">هزینه دستمزد مونتاژ:</span>
                      <span className="font-black font-mono text-slate-900">{formatNum(bom.laborCost || 0)} تومان</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">هزینه سربار تولید:</span>
                      <span className="font-black font-mono text-slate-900">{formatNum(bom.overheadCost || 0)} تومان</span>
                    </div>

                    <div className="bg-blue-100 p-2 rounded-lg border border-blue-300">
                      <span className="text-blue-900 block text-[10px] font-bold">بهای تمام‌شده کل:</span>
                      <span className="font-black font-mono text-blue-950 text-sm">{formatNum(bom.totalEstimatedCost)} تومان</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* 5. SUBTAB 3: RAW MATERIALS & COMPONENTS BANK */}
      {activeSubTab === 'components' && (
        <div className="space-y-4">
          <div className="bg-[#DDE2E9] p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="جستجو در قطعات و مواد اولیه..."
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            <div className="text-xs font-bold text-slate-700">
              تعداد قطعات تعریف‌شده: <span className="font-black text-slate-900 font-mono">{rawMaterialProducts.length}</span> قلم
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">نام قطعه / ماده اولیه</th>
                    <th className="py-3 px-3 text-center">کد کالا</th>
                    <th className="py-3 px-3 text-center">نوع</th>
                    <th className="py-3 px-3 text-center">واحد سنجش</th>
                    <th className="py-3 px-3 text-center">میانگین بهای برآوردی</th>
                    <th className="py-3 px-3 text-center">وضعیت</th>
                    <th className="py-3 px-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {rawMaterialProducts.map((p, idx) => {
                    const typeInfo = getProductTypeLabel(p.productType);
                    const isItemActive = p.isActive !== false;

                    return (
                      <tr key={p.id || idx} className={`hover:bg-slate-50/70 ${!isItemActive ? 'bg-slate-50/50 opacity-70' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-900">{p.name}</div>
                          {p.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{p.description}</div>}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">{p.code || '—'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${typeInfo.bg} ${typeInfo.text} ${typeInfo.border}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{p.unit || 'عدد'}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-900">
                          {p.price ? `${formatNum(p.price)} تومان` : (p.productionPrice || p.suggestedPrice || '—')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isItemActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isItemActive ? 'فعال' : 'غیرفعال'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditComponent(p)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                              title="ویرایش"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleComponentActive(p)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                isItemActive ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              }`}
                              title={isItemActive ? 'غیرفعال‌سازی قطعه' : 'فعال‌سازی مجدد'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT MANUFACTURED PRODUCT (SUBTAB 1) ================= */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setIsProductModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-lg border border-slate-300 shadow-2xl overflow-hidden my-auto"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#DCE6F2] px-5 py-4 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-blue-700" />
                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    {editingProduct ? 'ویرایش محصول تولیدی' : 'تعریف محصول تولیدی جدید'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-right">
                
                {/* Product Type Banner: Strictly Fixed to Manufactured (Rule 8) */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                      محصول تولیدی
                    </span>
                    <span className="text-xs text-blue-900 font-bold">
                      ماهیت کالا: دارای فرمول ساخت و خط مونتاژ (Manufactured)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">
                      نام محصول تولیدی <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={prodFormName}
                      onChange={e => setProdFormName(e.target.value)}
                      placeholder="مانند: شارژر باتری صنعتی ۱۰ آمپر"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 outline-none"
                    />
                  </div>

                  {/* Code */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">
                      کد یکتای محصول <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={prodFormCode}
                      onChange={e => setProdFormCode(e.target.value)}
                      placeholder="مانند: DEC-1210-CH"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono focus:bg-white focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">مدل تجاری</label>
                    <input
                      type="text"
                      value={prodFormModel}
                      onChange={e => setProdFormModel(e.target.value)}
                      placeholder="مانند: DEC-1210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  {/* Unit */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">واحد سنجش</label>
                    <select
                      value={prodFormUnit}
                      onChange={e => setProdFormUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer outline-none"
                    >
                      <option value="دستگاه">دستگاه</option>
                      <option value="عدد">عدد</option>
                      <option value="متر">متر</option>
                      <option value="کیلوگرم">کیلوگرم</option>
                      <option value="بسته">بسته</option>
                      <option value="ست">ست</option>
                    </select>
                  </div>

                  {/* Warranty */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">گارانتی (ماه)</label>
                    <input
                      type="text"
                      value={prodFormWarranty}
                      onChange={e => setProdFormWarranty(e.target.value)}
                      placeholder="12"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>
                </div>

                {/* Selling price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    قیمت فروش مصوب (تومان)
                  </label>
                  <input
                    type="text"
                    value={prodFormSellingPrice}
                    onChange={e => setProdFormSellingPrice(e.target.value)}
                    placeholder="مانند: ۴,۲۰۰,۰۰۰ تومان"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">توضیحات و مشخصات فنی</label>
                  <textarea
                    rows={2}
                    value={prodFormDescription}
                    onChange={e => setProdFormDescription(e.target.value)}
                    placeholder="مشخصات عملکردی، ولتاژ، جریان یا نکات تولید..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all"
                  >
                    {editingProduct ? 'ذخیره تغییرات محصول' : 'ثبت و تعریف محصول تولیدی'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: ADD / EDIT RAW MATERIAL / COMPONENT (SUBTAB 3) ================= */}
      <AnimatePresence>
        {isComponentModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setIsComponentModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-lg border border-slate-300 shadow-2xl overflow-hidden my-auto"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#DCE6F2] px-5 py-4 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-blue-700" />
                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    {editingComponentItem ? 'ویرایش قطعه / ماده اولیه' : 'تعریف قطعه یا ماده اولیه جدید'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComponentModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveComponent} className="p-5 space-y-4 text-right">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    نوع قلم مصرفی <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={compFormType}
                    onChange={e => setCompFormType(e.target.value as ProductType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="raw_material">🔩 قطعه یا ماده اولیه (جهت مصرف در خط مونتاژ)</option>
                    <option value="purchased">📦 کالای خریداری‌شده (قطعه تجاری)</option>
                    <option value="consumable">🧪 کالای مصرفی (وارنیش، بست، چسب، تینر)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">
                      نام قطعه <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={compFormName}
                      onChange={e => setCompFormName(e.target.value)}
                      placeholder="مانند: ترانسفورماتور ۱۲ ولت"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">
                      کد کالا <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={compFormCode}
                      onChange={e => setCompFormCode(e.target.value)}
                      placeholder="مانند: TR-1210-CU"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">واحد سنجش</label>
                    <select
                      value={compFormUnit}
                      onChange={e => setCompFormUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="عدد">عدد</option>
                      <option value="متر">متر</option>
                      <option value="کیلوگرم">کیلوگرم</option>
                      <option value="گرم">گرم</option>
                      <option value="بسته">بسته</option>
                      <option value="جفت">جفت</option>
                      <option value="ست">ست</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 block">میانگین بهای خرید / برآوردی (تومان)</label>
                    <input
                      type="text"
                      value={compFormCost}
                      onChange={e => setCompFormCost(e.target.value)}
                      placeholder="مانند: ۱۲۰,۰۰۰"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">توضیحات</label>
                  <textarea
                    rows={2}
                    value={compFormDescription}
                    onChange={e => setCompFormDescription(e.target.value)}
                    placeholder="مشخصات فنی قطعه..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsComponentModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all"
                  >
                    {editingComponentItem ? 'ذخیره تغییرات' : 'ثبت قطعه'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: ADD / EDIT BOM FORMULA BUILDER ================= */}
      <AnimatePresence>
        {isBomModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={() => setIsBomModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-3xl border border-slate-300 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-[#DCE6F2] px-5 py-3.5 border-b border-blue-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-700" />
                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    {editingBom ? 'ویرایش فرمول ساخت (BOM)' : 'ایجاد فرمول ساخت جدید (BOM)'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBomModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleSaveBom} className="p-4 sm:p-5 space-y-4 text-right overflow-y-auto flex-1">
                
                {/* Error Box */}
                {bomFormError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-black p-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{bomFormError}</span>
                  </div>
                )}

                {/* Main BOM Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Title */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-black text-slate-800 block">
                      عنوان فرمول ساخت <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bomFormTitle}
                      onChange={e => setBomFormTitle(e.target.value)}
                      placeholder="مانند: فرمول استاندارد ساخت شارژر ۱۰ آمپر"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 outline-none"
                    />
                  </div>

                  {/* Version */}
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-800 block">نسخه فرمول</label>
                    <input
                      type="text"
                      value={bomFormVersion}
                      onChange={e => setBomFormVersion(e.target.value)}
                      placeholder="1.0"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>
                </div>

                {/* Target Product Selection (Strictly active manufactured products) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-black text-slate-800 block">
                      محصول نهایی مقصد <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={bomFormTargetProdId}
                      onChange={e => {
                        const val = e.target.value;
                        setBomFormTargetProdId(val);
                        const sel = products.find(p => p.id === val);
                        if (sel && !bomFormTitle) {
                          setBomFormTitle(`فرمول ساخت ${sel.name}`);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer outline-none"
                    >
                      {activeManufacturedProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.model ? `(${p.model})` : ''} - کد: {p.code || 'بدون کد'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-800 block">تعداد خروجی</label>
                      <input
                        type="number"
                        min="1"
                        value={bomFormOutputQty}
                        onChange={e => setBomFormOutputQty(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-800 block">واحد خروجی</label>
                      <input
                        type="text"
                        value={bomFormOutputUnit}
                        onChange={e => setBomFormOutputUnit(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Toggle (Single active rule info) */}
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={bomFormIsActive}
                      onChange={e => setBomFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span>تعیین به عنوان فرمول فعال اصلی محصول (سایر فرمول‌های این محصول غیرفعال خواهند شد)</span>
                  </label>
                </div>

                {/* Components Table Builder */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-slate-700" />
                      <h3 className="text-xs sm:text-sm font-black text-slate-900">
                        اقلام و قطعات تشکیل‌دهنده (BOM Components)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddComponentRow}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن ردیف قطعه</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto p-1">
                    {bomFormComponents.map((cmp, idx) => {
                      const lineTotal = (cmp.quantity || 0) * (cmp.unitCost || 0) * (1 + (cmp.wastePercentage || 0) / 100);

                      return (
                        <div 
                          key={cmp.id || idx}
                          className="bg-[#E9EDF3] border border-slate-300 rounded-xl p-2.5 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-800 font-bold font-mono flex items-center justify-center text-[10px] shrink-0">
                              {idx + 1}
                            </span>

                            {/* Select from existing materials: Strictly raw_material, purchased, consumable */}
                            <div className="flex-1">
                              <select
                                onChange={e => {
                                  if (e.target.value) handleSelectRawMaterial(cmp.id, e.target.value);
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer outline-none"
                                defaultValue=""
                              >
                                <option value="" disabled>-- انتخاب سریع از بانک قطعات و مواد اولیه --</option>
                                {rawMaterialProducts.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.code ? `(${p.code})` : ''} - {getProductTypeLabel(p.productType).label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveComponentRow(cmp.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                              title="حذف ردیف"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            {/* Component Name */}
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                required
                                value={cmp.name}
                                onChange={e => handleUpdateComponentText(cmp.id, 'name', e.target.value)}
                                placeholder="نام قطعه / ماده اولیه *"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                              />
                            </div>

                            {/* Component Code */}
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={cmp.code || ''}
                                onChange={e => handleUpdateComponentText(cmp.id, 'code', e.target.value)}
                                placeholder="کد قطعه"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-800 outline-none"
                              />
                            </div>

                            {/* Quantity */}
                            <div className="sm:col-span-2 flex items-center gap-1">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                required
                                value={cmp.quantity || ''}
                                onChange={e => handleUpdateComponentNumber(cmp.id, 'quantity', parseFloat(e.target.value) || 0)}
                                placeholder="تعداد"
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-800 outline-none text-center"
                              />
                              <input
                                type="text"
                                value={cmp.unit || 'عدد'}
                                onChange={e => handleUpdateComponentText(cmp.id, 'unit', e.target.value)}
                                placeholder="واحد"
                                className="w-14 px-1 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 outline-none text-center"
                              />
                            </div>

                            {/* Unit Cost */}
                            <div className="sm:col-span-2">
                              <input
                                type="number"
                                min="0"
                                value={cmp.unitCost || ''}
                                onChange={e => handleUpdateComponentNumber(cmp.id, 'unitCost', parseFloat(e.target.value) || 0)}
                                placeholder="هزینه واحد (ت)"
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-800 outline-none text-center"
                              />
                            </div>

                            {/* Waste % */}
                            <div className="sm:col-span-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={cmp.wastePercentage || ''}
                                  onChange={e => handleUpdateComponentNumber(cmp.id, 'wastePercentage', parseFloat(e.target.value) || 0)}
                                  placeholder="پرتی٪"
                                  className="w-full px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-800 outline-none text-center"
                                  title="درصد افت و پرتی"
                                />
                                <span className="text-[10px] text-slate-500 font-mono font-bold">%</span>
                              </div>
                            </div>
                          </div>

                          {/* Line total summary */}
                          <div className="flex items-center justify-between text-[11px] text-slate-600 px-1 pt-1 border-t border-slate-200/80">
                            <input
                              type="text"
                              value={cmp.notes || ''}
                              onChange={e => handleUpdateComponentText(cmp.id, 'notes', e.target.value)}
                              placeholder="ملاحظات مونتاژ این قطعه (اختیاری)..."
                              className="bg-transparent border-none text-[11px] text-slate-500 outline-none flex-1"
                            />
                            <div className="font-bold text-slate-800">
                              هزینه ردیف: <span className="font-black font-mono text-blue-900">{formatNum(lineTotal)} تومان</span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Costs: Labor & Overhead */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-800 block">
                      هزینه دستمزد و مونتاژ تولید (تومان)
                    </label>
                    <input
                      type="text"
                      value={bomFormLaborCost}
                      onChange={e => setBomFormLaborCost(e.target.value)}
                      placeholder="۱۰۰,۰۰۰"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-800 block">
                      هزینه سربار، استهلاک و انرژی (تومان)
                    </label>
                    <input
                      type="text"
                      value={bomFormOverheadCost}
                      onChange={e => setBomFormOverheadCost(e.target.value)}
                      placeholder="۱۰۰,۰۰۰"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>
                </div>

                {/* Summary calculation box */}
                <div className="bg-[#DCE6F2] p-4 rounded-2xl border border-blue-300 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold">جمع هزینه مستقیم مواد و قطعات:</span>
                    <span className="font-black font-mono text-slate-900">{formatNum(calculatedDirectCost)} تومان</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold">جمع هزینه‌های دستمزد و سربار:</span>
                    <span className="font-black font-mono text-slate-900">
                      {formatNum(parseNumberInput(bomFormLaborCost) + parseNumberInput(bomFormOverheadCost))} تومان
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-blue-300 text-sm font-black text-blue-950">
                    <span>بهای تمام‌شده برآوردی یک واحد:</span>
                    <span className="font-mono text-base text-blue-900">{formatNum(calculatedTotalCost)} تومان</span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsBomModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all"
                  >
                    {editingBom ? 'ذخیره تغییرات فرمول' : 'ثبت نهایی فرمول ساخت (BOM)'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: VIEW BOM DETAILS (TREE VIEW) ================= */}
      <AnimatePresence>
        {viewingBom && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setViewingBom(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-2xl border border-slate-300 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#DCE6F2] px-5 py-4 border-b border-blue-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-700" />
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900">
                      {viewingBom.title}
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      محصول: <span className="font-bold">{viewingBom.productName}</span> | نسخه: {viewingBom.version || '1.0'} | وضعیت: {viewingBom.isActive ? 'فعال' : 'غیرفعال'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingBom(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-right overflow-y-auto flex-1 text-xs">
                {/* Info Card */}
                {viewingBom.description && (
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-slate-700 leading-relaxed">
                    <span className="font-bold text-blue-900 block mb-1">شرح و مانیفست ساخت:</span>
                    {viewingBom.description}
                  </div>
                )}

                {/* Tree / Table */}
                <div className="space-y-2">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>فهرست تفصیلی قطعات و مواد اولیه (BOM Tree)</span>
                  </h3>

                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3">نام قطعه</th>
                          <th className="py-2.5 px-3 text-center">کد قطعه</th>
                          <th className="py-2.5 px-3 text-center">مقدار مصرف</th>
                          <th className="py-2.5 px-3 text-center">هزینه واحد</th>
                          <th className="py-2.5 px-3 text-left">هزینه کل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {viewingBom.components.map((cmp, idx) => {
                          const lineCost = (cmp.quantity || 0) * (cmp.unitCost || 0) * (1 + (cmp.wastePercentage || 0) / 100);
                          return (
                            <tr key={cmp.id || idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-black text-slate-900">{cmp.name}</div>
                                {cmp.notes && <div className="text-[10px] text-slate-500 font-normal">{cmp.notes}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">{cmp.code || '—'}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold">
                                {cmp.quantity} {cmp.unit}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">{formatNum(cmp.unitCost)} ت</td>
                              <td className="py-2.5 px-3 text-left font-mono font-black text-slate-900">
                                {formatNum(lineCost)} ت
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-[#E9EDF3] p-4 rounded-xl border border-slate-300 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-bold">جمع هزینه مستقیم مواد:</span>
                    <span className="font-black font-mono">{formatNum(viewingBom.totalDirectCost)} تومان</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-bold">هزینه دستمزد تولید:</span>
                    <span className="font-black font-mono">{formatNum(viewingBom.laborCost || 0)} تومان</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-bold">هزینه سربار ساخت:</span>
                    <span className="font-black font-mono">{formatNum(viewingBom.overheadCost || 0)} تومان</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-black text-blue-900">
                    <span>بهای تمام‌شده کل برآوردی:</span>
                    <span className="font-mono">{formatNum(viewingBom.totalEstimatedCost)} تومان</span>
                  </div>
                </div>

                {/* Print button & Close */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>چاپ برگه ساخت</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingBom(null)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-xs"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default ProductionUnit;
