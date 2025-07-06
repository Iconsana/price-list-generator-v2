// src/services/claude-service.js - Updated to handle PDFs correctly
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import pdfImgConvert from 'pdf-img-convert'; // Add this import for PDF conversion

// Define available Claude models
const CLAUDE_MODELS = {
  // Current models as of May 2025
  CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-20250219',
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_SONNET_ORIGINAL: 'claude-3-5-sonnet-20240620',
  CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
  // Default model to use
  DEFAULT: 'claude-3-7-sonnet-20250219' // Using the latest model
};

// Create the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Processes a quote document using Claude Vision
 * @param {string} filePath - Path to the PDF or image file
 * @returns {Promise<Array>} - Array of extracted products
 */
export async function processQuoteWithClaude(filePath) {
  try {
    // Determine file type based on extension
    const fileExt = path.extname(filePath).toLowerCase();
    let base64Content;
    let mediaType;
    
    // If PDF, convert to PNG first
    if (fileExt === '.pdf') {
      console.log('Processing PDF file: Converting to PNG before sending to Claude');
      
      // Convert the first page of the PDF to PNG
      const pdfImgOptions = {  // Define options here
        width: 1600,  // High resolution for better OCR
        height: 2000  // Approximate height based on width
      };
      
      try {
        // Use pdfImgOptions here (not pngImgOptions)
        const pngPages = await pdfImgConvert.convert(filePath, pdfImgOptions); 
        
        if (pngPages && pngPages.length > 0) {
          // Use the first page as our image
          base64Content = Buffer.from(pngPages[0]).toString('base64');
          mediaType = 'image/png';
          console.log('Successfully converted PDF to PNG image');
        } else {
          throw new Error('Failed to convert PDF to PNG: No pages returned');
        }
      } catch (pdfConvertError) {
        console.error('Error converting PDF to image:', pdfConvertError);
        throw pdfConvertError;
      }
    } else {
      // For direct image files (JPG, PNG, etc.)
      const fileContent = fs.readFileSync(filePath);
      base64Content = fileContent.toString('base64');
      
      if (fileExt === '.jpg' || fileExt === '.jpeg') {
        mediaType = 'image/jpeg';
      } else if (fileExt === '.png') {
        mediaType = 'image/png';
      } else if (fileExt === '.gif') {
        mediaType = 'image/gif';
      } else if (fileExt === '.webp') {
        mediaType = 'image/webp';
      } else {
        throw new Error(`Unsupported file format: ${fileExt}`);
      }
    }
    
    console.log(`Sending file as ${mediaType} to Claude`);
    
    // Call Claude API with a detailed prompt
    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.DEFAULT,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `I need you to extract product information from this supplier quote or invoice. 

This document contains product listings with information like SKUs, descriptions and prices.

IMPORTANT: Extract ALL products found in the document, even if the formatting is unclear.

Look for:
1. Product codes or SKUs (alphanumeric codes identifying products)
2. Product descriptions or names
3. Unit prices (numbers that look like prices, often with currency symbols)
4. Quantities (if present)

FORMAT YOUR RESPONSE AS A JSON ARRAY LIKE THIS, with no additional text:
[
  {
    "sku": "ABC123",
    "description": "Product description here",
    "unitPrice": 10.99,
    "availableQuantity": 5
  },
  {
    "sku": "XYZ456", 
    "description": "Another product",
    "unitPrice": 25.50,
    "availableQuantity": 10
  }
]

If you can't find any product SKUs and prices, return an empty array: []

For unclear SKUs, use the most likely text. For missing quantities, use 1 or 10.
Price formats might include R100, $100, etc. - extract just the number.

Do not include any explanations - ONLY the JSON array.`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Content
              }
            }
          ]
        }
      ]
    });
    
    
    // Parse the response to extract the JSON
    const textResponse = response.content[0].text;
    console.log("Claude raw response:", textResponse.substring(0, 500) + "...");
    
    // Find the JSON array in the response
    const jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.log("No valid JSON found in response. Full response:");
      console.log(textResponse);
      return [];
    }
    
    // Parse the JSON array
    try {
      const extractedText = jsonMatch[0].trim();
      console.log("Extracted JSON text:", extractedText.substring(0, 200) + "...");
      
      const extractedProducts = JSON.parse(extractedText);
      console.log(`Extracted ${extractedProducts.length} products from document`);
      
      // Validate and clean up the data
      const validatedProducts = extractedProducts.map(product => ({
        sku: product.sku || "Unknown SKU",
        description: product.description || `Product ${product.sku || "Unknown"}`,
        quantity: parseInt(product.quantity) || 1,
        unitPrice: parseFloat(product.unitPrice) || 0,
        availableQuantity: parseInt(product.availableQuantity) || 10
      }));
      
      return validatedProducts;
    } catch (jsonError) {
      console.error('Error parsing JSON from Claude response:', jsonError);
      console.log('Raw matched text:', jsonMatch[0].substring(0, 200) + "...");
      return [];
    }
  } catch (error) {
    console.error('Error processing quote with Claude:', error);
    console.error('Error details:', error.stack);
    return [];
  }
}

// Export the models for reference
export { CLAUDE_MODELS };
