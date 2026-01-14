// set-bucket-policy.js
const { S3Client, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

const HARDCODED_CONFIG = {
  region: 'sfo3',
  bucket: 'hale-project',
  accessKeyId: 'DO00JTQD8XWPQHHGTJ7K',
  secretAccessKey: 'Mij6txNAamFqYtbjyJZQo3z4I6ey3//o/TNlBLkEzpo',
  endpoint: 'https://sfo3.digitaloceanspaces.com'
};

const s3Client = new S3Client({
  endpoint: HARDCODED_CONFIG.endpoint,
  region: HARDCODED_CONFIG.region,
  credentials: {
    accessKeyId: HARDCODED_CONFIG.accessKeyId,
    secretAccessKey: HARDCODED_CONFIG.secretAccessKey
  },
  forcePathStyle: true
});

// ✅ Policy to make all files publicly readable
const bucketPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'PublicRead',
      Effect: 'Allow',
      Principal: '*',
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${HARDCODED_CONFIG.bucket}/*`]
    }
  ]
};

async function setBucketPolicy() {
  try {
    console.log('Setting bucket policy for:', HARDCODED_CONFIG.bucket);
    console.log('Policy:', JSON.stringify(bucketPolicy, null, 2));
    
    const command = new PutBucketPolicyCommand({
      Bucket: HARDCODED_CONFIG.bucket,
      Policy: JSON.stringify(bucketPolicy)
    });

    const result = await s3Client.send(command);
    
    console.log('\n✅ SUCCESS! Bucket policy set.');
    console.log('All files in hale-project/* are now publicly readable');
    console.log('\nTest URL format:');
    console.log(`https://${HARDCODED_CONFIG.bucket}.${HARDCODED_CONFIG.region}.digitaloceanspaces.com/floor-plans/your-file.png`);
    
  } catch (error) {
    console.error('\n❌ FAILED to set bucket policy');
    console.error('Error:', error.message);
    console.error('Code:', error.Code);
    console.error('Status:', error.$metadata?.httpStatusCode);
    
    if (error.Code === 'MalformedPolicy') {
      console.log('\n💡 Policy format is wrong');
    } else if (error.Code === 'AccessDenied') {
      console.log('\n💡 Access keys do not have permission to set bucket policy');
      console.log('Solution: Regenerate keys with full permissions');
    }
  }
}

setBucketPolicy();