import React from 'react';
import { X, Star, ShoppingCart, Heart, CheckCircle2, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import { ComboPack, StoreProduct } from '../../../utils/customerStoreCatalog';

interface ProductDetailModalProps {
  product: StoreProduct | null;
  combo: ComboPack | null;
  cartQty: number;
  isWishlisted: boolean;
  isCompared: boolean;
  onClose: () => void;
  onAddToCart: (id: string) => void;
  onUpdateQty: (id: string, nextQty: number) => void;
  onToggleWishlist: (id: string) => void;
  onToggleCompare: (id: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  combo,
  cartQty,
  isWishlisted,
  isCompared,
  onClose,
  onAddToCart,
  onUpdateQty,
  onToggleWishlist,
  onToggleCompare,
}) => {
  if (!product && !combo) return null;

  const activeId = product ? product.id : combo!.id;
  const title = product ? product.name : combo!.title;
  const brand = product ? product.brand : 'Business Manager 360 Value';
  const image = product ? product.image : combo!.image;
  const price = product ? product.price : combo!.price;
  const mrp = product ? product.mrp : combo!.mrp;
  const rating = product ? product.rating : combo!.rating;
  const gstRate = product ? product.gstRate : combo!.gstRate;
  const hsn = product ? product.hsn : combo!.hsn;
  const discountPercent = product
    ? product.discountPercent
    : Math.round(((combo!.mrp - combo!.price) / combo!.mrp) * 100);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-500">
            {product ? product.category : 'Combo Offer Bundle'} · HSN {hsn}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 relative bg-slate-50 rounded-2xl border border-slate-100 p-4 flex items-center justify-center">
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold">
              {discountPercent}% OFF
            </span>
            <img
              src={image}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-52 object-contain rounded-xl"
            />
          </div>

          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#1D63ED]">{brand}</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  {product && <span className="text-slate-400 font-normal">({product.reviewCount})</span>}
                </span>
              </div>

              <h3 className="text-lg font-extrabold text-slate-900 leading-snug">{title}</h3>

              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  ₹{price.toLocaleString('en-IN')}
                </span>
                <span className="text-sm text-slate-400 line-through tabular-nums">
                  ₹{mrp.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  Save ₹{(mrp - price).toLocaleString('en-IN')}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {product ? product.description : combo!.description}
              </p>

              {product ? (
                <ul className="space-y-1.5 pt-1">
                  {product.highlights.map((hl) => (
                    <li key={hl} className="flex items-center gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="pt-1 space-y-1.5">
                  <div className="text-xs font-bold text-slate-800">Bundle Contents:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {combo!.includedChips.map((chip) => (
                      <span
                        key={chip}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    product && product.availableStock <= 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {product
                    ? product.availableStock > 0
                      ? `${product.availableStock} available${product.reservedStock > 0 ? ` (${product.reservedStock} reserved)` : ''}`
                      : 'Out of Stock'
                    : 'Bundle In Stock'}
                </span>
                {product?.wholesalePrice && product?.minWholesaleQty && (
                  <>
                    <span>·</span>
                    <span className="text-[#1D63ED] font-semibold">
                      Wholesale ₹{product.wholesalePrice.toLocaleString('en-IN')} on {product.minWholesaleQty}+ units
                    </span>
                  </>
                )}
                <span>·</span>
                <span>GST {gstRate}% tax invoice included</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
              {cartQty > 0 ? (
                <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(activeId, cartQty - 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-blue-200 text-[#1D63ED] font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-extrabold text-[#1D63ED] tabular-nums">{cartQty} in Cart</span>
                  <button
                    type="button"
                    disabled={Boolean(product && cartQty >= product.availableStock)}
                    onClick={() => onUpdateQty(activeId, cartQty + 1)}
                    className="w-8 h-8 rounded-lg bg-[#1D63ED] disabled:bg-slate-300 text-white font-bold hover:bg-[#1552CC] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(product && product.availableStock <= 0)}
                  onClick={() => onAddToCart(activeId)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    {product && product.availableStock <= 0
                      ? 'Out of Stock'
                      : combo
                      ? 'Add Combo to Cart'
                      : 'Add to Cart'}
                  </span>
                </button>
              )}

              {product && (
                <>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(product.id)}
                    aria-label="Toggle wishlist"
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      isWishlisted
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCompare(product.id)}
                    aria-label="Toggle compare"
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      isCompared
                        ? 'bg-blue-50 border-blue-300 text-[#1D63ED]'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
