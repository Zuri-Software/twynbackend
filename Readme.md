# Flux LoRA Backend (TypeScript + Express)

Backend server to manage Flux LoRA training and image generation using the [Fal.ai API](https://fal.ai/models/fal-ai/flux-lora/api).

## 📦 Tech Stack
- Node.js + Express
- TypeScript
- Fal.ai SDK
- Jest (test coverage goal: 80%+)

## 🚀 Features
- Upload and train LoRA models from user images
- Poll training status
- Generate images using LoRA ID and prompt
- Webhook-ready for async updates

## 🛠 Setup

```bash
git clone https://github.com/yourname/flux-backend
cd flux-backend
cp .env.example .env
npm install
npm run dev
