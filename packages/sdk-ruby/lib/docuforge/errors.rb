# frozen_string_literal: true

module DocuForge
  class Error < StandardError
    attr_reader :status_code, :code, :message

    def initialize(message = "Request failed", status_code: 0, code: "UNKNOWN")
      @message = message
      @status_code = status_code
      @code = code
      super(message)
    end
  end

  class AuthenticationError < Error
    def initialize(message = "Invalid API key")
      super(message, status_code: 401, code: "UNAUTHORIZED")
    end
  end

  class RateLimitError < Error
    attr_reader :retry_after

    def initialize(message = "Rate limit exceeded", retry_after: 1)
      @retry_after = retry_after
      super(message, status_code: 429, code: "RATE_LIMITED")
    end
  end

  class ValidationError < Error
    def initialize(message = "Validation failed")
      super(message, status_code: 400, code: "VALIDATION_ERROR")
    end
  end

  class NotFoundError < Error
    def initialize(message = "Not found")
      super(message, status_code: 404, code: "NOT_FOUND")
    end
  end

  class UsageLimitError < Error
    def initialize(message = "Usage limit exceeded")
      super(message, status_code: 403, code: "USAGE_LIMIT")
    end
  end
end
