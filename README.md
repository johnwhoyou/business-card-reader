# Business Card Reader

A modern web application that captures or uploads business card photos, extracts text using OCR technology, and saves the parsed information to Airtable.

## Features

### Phase 1: Text Extraction ✅
- 📸 **Camera Capture**: Take photos directly using device camera
- 📁 **File Upload**: Upload existing business card images
- 🔍 **OCR Processing**: Extract text using OpenAI Vision API (fast and accurate)
- 📝 **Smart Parsing**: Automatically identify name, title, company, phone, email, website, and address
- 🎨 **Modern UI**: Clean, responsive interface with Tailwind CSS

### Phase 2: Airtable Integration ✅
- 💾 **Data Storage**: Save extracted business card data to Airtable
- 🔗 **Easy Setup**: Simple configuration with environment variables
- ✅ **Error Handling**: Comprehensive error handling and user feedback

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **OCR**: OpenAI Vision API
- **Database**: Airtable
- **Icons**: Lucide React

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI

1. Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Make sure you have credits in your OpenAI account (Vision API requires payment)

### 3. Configure Airtable

1. Create an Airtable account at [airtable.com](https://airtable.com)
2. Create a new base with a table called "Business Cards"
3. Add the following fields to your table:
   - `Name` (Single line text)
   - `Title` (Single line text)
   - `Company` (Single line text)
   - `Phone` (Phone number)
   - `Email` (Email)
   - `Website` (URL)
   - `Address` (Long text)
   - `Date Added` (Date)

4. Get your Airtable credentials:
   - **API Key**: Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
   - **Base ID**: Found in your Airtable API documentation
   - **Table Name**: "Business Cards" (or your custom name)

### 4. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Update `.env.local` with your credentials:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   NEXT_PUBLIC_AIRTABLE_API_KEY=your_airtable_api_key_here
   NEXT_PUBLIC_AIRTABLE_BASE_ID=your_airtable_base_id_here
   NEXT_PUBLIC_AIRTABLE_TABLE_NAME=Business Cards
   ```

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Docker Deployment

### Option 1: Docker Compose (Recommended)

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

2. **Run in detached mode**:
   ```bash
   docker-compose up -d --build
   ```

3. **Stop the container**:
   ```bash
   docker-compose down
   ```

### Option 2: Docker Commands

1. **Build the Docker image**:
   ```bash
   docker build -t business-card-reader .
   ```

2. **Run the container**:
   ```bash
   docker run -p 3000:3000 \
     -e OPENAI_API_KEY=your_openai_api_key \
     -e NEXT_PUBLIC_AIRTABLE_API_KEY=your_airtable_api_key \
     -e NEXT_PUBLIC_AIRTABLE_BASE_ID=your_airtable_base_id \
     -e NEXT_PUBLIC_AIRTABLE_TABLE_NAME=CRM \
     business-card-reader
   ```

3. **Run with environment file**:
   ```bash
   docker run -p 3000:3000 --env-file .env.local business-card-reader
   ```

### Environment Variables for Docker

Create a `.env.local` file or set these environment variables:

```env
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_AIRTABLE_API_KEY=your_airtable_api_key_here
NEXT_PUBLIC_AIRTABLE_BASE_ID=your_airtable_base_id_here
NEXT_PUBLIC_AIRTABLE_TABLE_NAME=CRM
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Health Check

The Docker container includes a health check endpoint at `/api/health` that returns the application status.

## Usage

1. **Capture or Upload**: Use the camera to take a photo or upload an existing image
2. **Extract Text**: Click "Extract Text" to process the image with OCR
3. **Review Data**: Check the parsed information in the results section
4. **Save to Airtable**: Click "Save to Airtable" to store the data

## Browser Compatibility

- **Camera Access**: Requires HTTPS in production (HTTP works for localhost)
- **File Upload**: Supported in all modern browsers
- **OCR Processing**: Works in all browsers with JavaScript enabled

## Troubleshooting

### Camera Not Working
- Ensure you're using HTTPS in production
- Check browser permissions for camera access
- Try refreshing the page and allowing camera access

### OCR Issues
- Ensure you have a valid OpenAI API key with credits
- Check that your OpenAI API key has access to GPT-4 Vision
- Ensure the image is clear and well-lit
- Business cards with small text may need higher resolution
- Try different angles or lighting conditions

### Airtable Connection Issues
- Verify your API key and Base ID are correct
- Check that the table name matches your Airtable setup
- Ensure your API key has permission to write to the base

## Development

### Project Structure

```
business-card-reader/
├── app/
│   ├── api/
│   │   └── extract-text/
│   │       └── route.ts     # OpenAI Vision API endpoint
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main application page
├── lib/
│   ├── ocr.ts               # OCR functionality (OpenAI integration)
│   ├── text-parser.ts       # Business card data parsing
│   └── airtable.ts          # Airtable integration
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.