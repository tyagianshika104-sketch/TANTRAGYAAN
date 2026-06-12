import io
import logging
from typing import Optional
from pathlib import Path
import tempfile

import ibm_boto3
from ibm_botocore.client import Config, ClientError

from config import COS_API_KEY, COS_ENDPOINT, COS_INSTANCE_CRN, COS_BUCKET_NAME

logger = logging.getLogger(__name__)

_cos_client = None

def get_cos_client():
    global _cos_client
    if _cos_client is not None:
        return _cos_client
    
    if not all([COS_API_KEY, COS_ENDPOINT, COS_INSTANCE_CRN]):
        return None
        
    try:
        _cos_client = ibm_boto3.client(
            "s3",
            ibm_api_key_id=COS_API_KEY,
            ibm_service_instance_id=COS_INSTANCE_CRN,
            config=Config(signature_version="oauth"),
            endpoint_url=COS_ENDPOINT
        )
        # Ensure bucket exists
        try:
            _cos_client.head_bucket(Bucket=COS_BUCKET_NAME)
        except ClientError as e:
            error_code = int(e.response['Error']['Code'])
            if error_code == 404:
                _cos_client.create_bucket(Bucket=COS_BUCKET_NAME)
            else:
                raise
        logger.info("IBM Cloud Object Storage initialized")
        return _cos_client
    except Exception as e:
        logger.error(f"Failed to initialize IBM COS: {e}")
        return None

def upload_file_object(file_obj, filename: str, content_type: str = "application/pdf") -> Optional[str]:
    """Upload a file-like object to IBM COS and return the object key."""
    cos = get_cos_client()
    if not cos:
        return None
        
    try:
        # Move cursor to start
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
            
        cos.upload_fileobj(
            file_obj,
            COS_BUCKET_NAME,
            filename,
            ExtraArgs={'ContentType': content_type}
        )
        return filename
    except Exception as e:
        logger.error(f"Failed to upload to COS: {e}")
        return None

def download_to_temp_file(filename: str) -> Optional[str]:
    """Download a file from COS to a temporary file and return the path."""
    cos = get_cos_client()
    if not cos:
        return None
        
    try:
        temp_dir = tempfile.gettempdir()
        local_path = str(Path(temp_dir) / filename)
        cos.download_file(COS_BUCKET_NAME, filename, local_path)
        return local_path
    except Exception as e:
        logger.error(f"Failed to download from COS: {e}")
        return None

def is_cos_configured() -> bool:
    return bool(COS_API_KEY and COS_ENDPOINT and COS_INSTANCE_CRN)
