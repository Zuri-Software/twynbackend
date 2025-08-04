// Delete all objects in a folder
export async function deleteS3Folder(folder: string): Promise<void> {
  const listCommand = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET!,
    Prefix: `${folder}/`
  });
  const listResponse = await s3.send(listCommand);
  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    return;
  }
  const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }));
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: process.env.S3_BUCKET!,
    Delete: { Objects: objectsToDelete }
  });
  await s3.send(deleteCommand);
}
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function uploadBuffer(
  buffer: Buffer,
  folder: string,
  contentType: string
): Promise<string> {
  const key = `${folder}/${uuidv4()}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function listImages(folder: string = 'generated'): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: `${folder}/`,
      MaxKeys: 1000 // Adjust as needed
    });

    const response = await s3.send(command);
    
    if (!response.Contents) {
      return [];
    }

    // Convert S3 keys to full URLs and filter out any directories
    const imageUrls = response.Contents
      .filter(obj => obj.Key && obj.Size && obj.Size > 0) // Filter out directories and empty objects
      .map(obj => `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`)
      .sort((a, b) => b.localeCompare(a)); // Sort by key descending (newest first, assuming UUID ordering)

    return imageUrls;
  } catch (error) {
    console.error('Error listing images from S3:', error);
    throw error;
  }
}

// Get all generated images for a user across all their models
export async function getAllGeneratedImagesForUser(userId: string): Promise<string[]> {
  try {
    console.log(`Fetching all generated images for user: ${userId}`);
    
    // First, get all objects under the user's folder to find model directories
    const listModelsCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: `users/${userId}/`,
      Delimiter: '/', // This helps us get "folders" rather than all files
      MaxKeys: 1000
    });

    const modelsResponse = await s3.send(listModelsCommand);
    
    if (!modelsResponse.CommonPrefixes) {
      console.log(`No models found for user ${userId}`);
      return [];
    }

    // Extract model IDs from the common prefixes
    const modelIds = modelsResponse.CommonPrefixes
      .map(prefix => prefix.Prefix?.replace(`users/${userId}/`, '').replace('/', ''))
      .filter(Boolean);

    console.log(`Found ${modelIds.length} models for user ${userId}:`, modelIds);

    // Get generated images from each model's generations folder
    const allImagesWithTimestamp: Array<{url: string, lastModified: Date}> = [];
    
    for (const modelId of modelIds) {
      try {
        const generationsCommand = new ListObjectsV2Command({
          Bucket: process.env.S3_BUCKET!,
          Prefix: `users/${userId}/${modelId}/generations/`,
          MaxKeys: 1000
        });

        const generationsResponse = await s3.send(generationsCommand);
        
        if (generationsResponse.Contents) {
          const modelImagesWithTimestamp = generationsResponse.Contents
            .filter(obj => obj.Key && obj.Size && obj.Size > 0)
            .map(obj => ({
              url: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
              lastModified: obj.LastModified || new Date(0)
            }));
          
          allImagesWithTimestamp.push(...modelImagesWithTimestamp);
          console.log(`Found ${modelImagesWithTimestamp.length} generated images for model ${modelId}`);
        }
      } catch (error) {
        console.error(`Error fetching generated images for model ${modelId}:`, error);
        // Continue with other models even if one fails
      }
    }

    // Sort all images by timestamp across all models (newest first)
    allImagesWithTimestamp.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const allImages = allImagesWithTimestamp.map(item => item.url);
    
    console.log(`Total generated images found for user ${userId}: ${allImages.length}`);
    
    // Debug: Log first few images with timestamps to verify sorting
    if (allImagesWithTimestamp.length > 0) {
      console.log(`First 3 images (newest) with timestamps:`);
      for (let i = 0; i < Math.min(3, allImagesWithTimestamp.length); i++) {
        const item = allImagesWithTimestamp[i];
        console.log(`  ${i + 1}. ${item.lastModified.toISOString()} - ${item.url.split('/').pop()}`);
      }
    }
    return allImages;
    
  } catch (error) {
    console.error(`Error listing all generated images for user ${userId}:`, error);
    throw error;
  }
}

// Get training images for a specific model
export async function getTrainingImages(userId: string, modelId: string): Promise<string[]> {
  try {
    console.log(`🔍 [DEBUG] getTrainingImages called for model ${modelId}, userId: ${userId}`);
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: `users/${userId}/${modelId}/training/`,
      MaxKeys: 100
    });

    const response = await s3.send(command);
    
    if (!response.Contents) {
      console.log(`No training images found for model ${modelId} with prefix "users/${userId}/${modelId}/training/"`);
      return [];
    }

    const imageUrls = response.Contents
      .filter(obj => obj.Key && obj.Size && obj.Size > 0)
      .map(obj => `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`)
      .sort(); // Sort alphabetically

    console.log(`✅ Found ${imageUrls.length} training images for model ${modelId}`);
    return imageUrls;
  } catch (error) {
    console.error(`Error listing training images for model ${modelId}:`, error);
    throw error;
  }
}

// Delete all training images for a specific model
export async function deleteTrainingImages(userId: string, modelId: string): Promise<void> {
  try {
    console.log(`🗑️ [DEBUG] Starting deletion for model: "${modelId}"`);
    console.log(`🗑️ [DEBUG] Using S3 bucket: ${process.env.S3_BUCKET}`);
    console.log(`🗑️ [DEBUG] Using AWS region: ${process.env.AWS_REGION}`);
    console.log(`🗑️ [DEBUG] Search prefix: "users/${userId}/${modelId}/training/"`);
    
    // First, list all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: `users/${userId}/${modelId}/training/`,
      MaxKeys: 1000
    });

    console.log(`🗑️ [DEBUG] Executing ListObjectsV2Command...`);
    const listResponse = await s3.send(listCommand);
    
    console.log(`🗑️ [DEBUG] ListObjectsV2 response:`, {
      KeyCount: listResponse.KeyCount,
      ContentsLength: listResponse.Contents?.length || 0,
      IsTruncated: listResponse.IsTruncated,
      Keys: listResponse.Contents?.map(obj => obj.Key) || []
    });
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log(`🗑️ [DEBUG] No training images found for model ${modelId} with prefix "users/${userId}/${modelId}/training/"`);
      return;
    }

    // Prepare objects for deletion
    const objectsToDelete = listResponse.Contents
      .filter(obj => obj.Key) // Ensure Key exists
      .map(obj => ({ Key: obj.Key! }));

    console.log(`🗑️ [DEBUG] Objects to delete:`, objectsToDelete);

    if (objectsToDelete.length === 0) {
      console.log(`🗑️ [DEBUG] No valid objects to delete for model ${modelId}`);
      return;
    }

    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: process.env.S3_BUCKET!,
      Delete: {
        Objects: objectsToDelete,
        Quiet: false // Get detailed response
      }
    });

    console.log(`🗑️ [DEBUG] Executing DeleteObjectsCommand for ${objectsToDelete.length} objects...`);
    const deleteResponse = await s3.send(deleteCommand);
    
    console.log(`🗑️ [DEBUG] Delete response:`, {
      DeletedCount: deleteResponse.Deleted?.length || 0,
      ErrorsCount: deleteResponse.Errors?.length || 0,
      Deleted: deleteResponse.Deleted,
      Errors: deleteResponse.Errors
    });
    
    console.log(`✅ Successfully requested deletion of ${objectsToDelete.length} training images for model ${modelId}`);
    
    if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
      console.error(`❌ Some objects failed to delete:`, deleteResponse.Errors);
      throw new Error(`Failed to delete ${deleteResponse.Errors.length} objects`);
    }
    
    if (!deleteResponse.Deleted || deleteResponse.Deleted.length === 0) {
      console.warn(`⚠️ No objects were actually deleted - this might indicate a permissions issue`);
    }
    
  } catch (error) {
    console.error(`❌ Error deleting training images for model ${modelId}:`, error);
    throw error;
  }
}

// List objects in S3 folder
export async function listS3Objects(prefix: string): Promise<any[]> {
  const command = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET!,
    Prefix: prefix
  });
  const response = await s3.send(command);
  return response.Contents || [];
}

// Copy S3 object to new location
export async function copyS3Object(sourceKey: string, destinationKey: string): Promise<void> {
  const command = new CopyObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    CopySource: `${process.env.S3_BUCKET}/${sourceKey}`,
    Key: destinationKey
  });
  await s3.send(command);
}

// Delete single S3 object
export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key
  });
  await s3.send(command);
}

// Check if user has temp onboarding folder with images
export async function checkOnboardingTempFolder(userId: string): Promise<{
  exists: boolean;
  tempFolderName?: string;
  imageCount?: number;
  imageUrls?: string[];
}> {
  try {
    console.log(`[S3] Checking for onboarding temp folder for user: ${userId}`);
    
    // List all folders under users/{userId}/ looking for temp_ prefixed folders
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: `users/${userId}/temp_`,
      Delimiter: '/',
      MaxKeys: 100
    });

    const response = await s3.send(command);
    
    if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
      console.log(`[S3] No temp folders found for user ${userId}`);
      return { exists: false };
    }

    // Find the first temp folder with training images
    for (const prefix of response.CommonPrefixes) {
      const tempFolderPath = prefix.Prefix;
      if (!tempFolderPath) continue;
      
      // Extract temp folder name (e.g., "temp_1234567890_abc123")
      const tempFolderName = tempFolderPath.split('/')[2]; // users/userId/tempFolderName/
      
      console.log(`[S3] Found temp folder: ${tempFolderName}`);
      
      // Check for training images in this temp folder
      const trainingCommand = new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET!,
        Prefix: `${tempFolderPath}training/`,
        MaxKeys: 50
      });

      const trainingResponse = await s3.send(trainingCommand);
      
      if (trainingResponse.Contents && trainingResponse.Contents.length > 0) {
        const imageUrls = trainingResponse.Contents
          .filter(obj => obj.Key && obj.Size && obj.Size > 0)
          .map(obj => `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`)
          .sort();

        console.log(`[S3] Found temp folder with ${imageUrls.length} images: ${tempFolderName}`);
        
        return {
          exists: true,
          tempFolderName,
          imageCount: imageUrls.length,
          imageUrls
        };
      }
    }

    console.log(`[S3] No temp folders with training images found for user ${userId}`);
    return { exists: false };

  } catch (error) {
    console.error(`[S3] Error checking onboarding temp folder for user ${userId}:`, error);
    throw error;
  }
}

// Move images from temp onboarding folder to permanent model folder
export async function moveTempFolderToModelFolder(
  userId: string, 
  tempFolderName: string, 
  modelId: string
): Promise<{
  success: boolean;
  movedCount: number;
  imageUrls: string[];
}> {
  try {
    console.log(`[S3] Moving temp folder ${tempFolderName} to model ${modelId} for user ${userId}`);
    
    const tempPrefix = `users/${userId}/${tempFolderName}/training/`;
    const modelPrefix = `users/${userId}/${modelId}/training/`;
    
    // List all objects in temp folder
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: tempPrefix,
      MaxKeys: 100
    });

    const listResponse = await s3.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log(`[S3] No objects found in temp folder ${tempFolderName}`);
      return { success: true, movedCount: 0, imageUrls: [] };
    }

    console.log(`[S3] Found ${listResponse.Contents.length} objects to move`);
    
    const imageUrls: string[] = [];
    let movedCount = 0;

    // Copy each object to new location and delete from old location
    for (const obj of listResponse.Contents) {
      if (!obj.Key) continue;
      
      const originalKey = obj.Key;
      const fileName = originalKey.split('/').pop(); // Get filename from the end
      const newKey = `${modelPrefix}${fileName}`;
      
      try {
        // Copy object to new location
        const copyCommand = new CopyObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          CopySource: `${process.env.S3_BUCKET}/${originalKey}`,
          Key: newKey,
        });
        
        await s3.send(copyCommand);
        console.log(`[S3] Copied: ${originalKey} → ${newKey}`);
        
        // Delete original object
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: originalKey,
        });
        
        await s3.send(deleteCommand);
        console.log(`[S3] Deleted original: ${originalKey}`);
        
        // Add to result URLs
        const imageUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`;
        imageUrls.push(imageUrl);
        movedCount++;
        
      } catch (moveError) {
        console.error(`[S3] Failed to move ${originalKey}:`, moveError);
        // Continue with other files even if one fails
      }
    }

    console.log(`[S3] Successfully moved ${movedCount}/${listResponse.Contents.length} images from temp folder to model ${modelId}`);
    
    return {
      success: true,
      movedCount,
      imageUrls: imageUrls.sort()
    };

  } catch (error) {
    console.error(`[S3] Error moving temp folder to model folder:`, error);
    throw error;
  }
}