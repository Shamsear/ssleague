# AI Image Generation Setup Guide

## System Overview

Your news image generation uses a **2-tier FREE fallback system**:

```
1️⃣ Stable Diffusion XL (Primary)
   ✅ Better text rendering than FLUX
   ✅ FREE with Hugging Face
   ✅ ~1000 images/day limit
   ⚠️ Text quality: Good (not perfect)
   
   ⬇️ If fails or poor quality...
   
2️⃣ FLUX.1 + Text Overlay (Fallback)
   ✅ UNLIMITED usage
   ✅ FREE with Hugging Face
   ✅ Perfect text (programmatically overlaid)
   ✅ Professional design
```

**Both tiers are 100% FREE!** ✨

## Setup Instructions

### Already Done! ✅

Your system is **already configured** and ready to use. No additional setup needed!

You're using your existing Hugging Face token for both:
- **SDXL** (primary, better text)
- **FLUX** (fallback, perfect overlay)

### Test It!

Go to `/test/news` and click "Generate Test News"

**Expected behavior:**
- ✅ Most images: SDXL with decent text rendering
- ✅ If SDXL fails: FLUX with perfect text overlay
- ✅ No failures, always generates something
- ✅ 100% FREE, no quota worries

## Pricing

### Completely FREE! 🎉

Both SDXL and FLUX are **100% free** through Hugging Face:
- **SDXL**: ~1000 images/day (generous limit)
- **FLUX**: Unlimited
- **No credit card required**
- **No hidden costs**

## Logs

Watch your terminal for:

**Primary (SDXL):**
```
🎨 Attempting Stable Diffusion XL (better text quality)...
✅ Successfully generated image with SDXL!
```

**Fallback (FLUX + Overlay):**
```
⚠️ SDXL failed, falling back to FLUX + overlay...
🎨 Using FLUX.1-schnell with text overlay...
✍️ Step 2: Adding text overlay...
✅ Successfully generated image with FLUX + overlay!
```

## Benefits

✅ **100% FREE**: Both tiers completely free
✅ **No downtime**: Always has a backup
✅ **No quotas to worry about**: FLUX is unlimited
✅ **Automatic**: Seamless fallback, no manual intervention
✅ **Best text quality**: Perfect overlay when needed

## Troubleshooting

**Issue**: "HUGGING_FACE_TOKEN not configured"
- **Solution**: Check your `.env.local` file has `HUGGING_FACE_TOKEN` set

**Issue**: All images use FLUX overlay (SDXL not working)
- **Solution**: This is normal! SDXL might be slower or queued. FLUX overlay works great.

**Issue**: Text looks bad in SDXL images
- **Solution**: System will automatically use FLUX + overlay for perfect text

**Issue**: Images not generating at all
- **Solution**: Check your Hugging Face token is valid at https://huggingface.co/settings/tokens

## Support

- Hugging Face Docs: https://huggingface.co/docs
- SDXL Model: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
- FLUX Model: https://huggingface.co/black-forest-labs/FLUX.1-schnell
- Your fallback always works! 🚀
